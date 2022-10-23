/*
 * Copyright (C) 2016 - present Juergen Zimmermann, Hochschule Karlsruhe
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Das Modul besteht aus der Klasse {@linkcode MonitorReadService}.
 * @packageDocumentation
 */
import { Monitor, type RefreshRate } from './../entity/monitor.entity.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { MonitorValidationService } from './monitor-validation.service.js';
import { QueryBuilder } from './query-builder.js';
import { Repository } from 'typeorm';
import { getLogger } from '../../logger/logger.js';

export interface Suchkriterien {
    readonly name?: string;
    readonly hersteller?: string;
    readonly preis?: number;
    readonly bestand?: number;
    readonly curved?: boolean;
    readonly refreshRate?: RefreshRate;
    readonly highres?: boolean;
    readonly slim?: boolean;
}

/**
 * Die Klasse `MonitorReadService` implementiert das Lesen für Monitore und greift
 * mit _TypeORM_ auf eine relationale DB zu.
 */
@Injectable()
export class MonitorReadService {
    readonly #repo: Repository<Monitor>;

    readonly #monitorProps: string[];

    readonly #queryBuilder: QueryBuilder;

    readonly #validationService: MonitorValidationService;

    readonly #logger = getLogger(MonitorReadService.name);

    constructor(
        @InjectRepository(Monitor) repo: Repository<Monitor>,
        queryBuilder: QueryBuilder,
        validationService: MonitorValidationService,
    ) {
        this.#repo = repo;
        const monitorDummy = new Monitor();
        this.#monitorProps = Object.getOwnPropertyNames(monitorDummy);
        this.#queryBuilder = queryBuilder;
        this.#validationService = validationService;
    }

    // Rueckgabetyp Promise bei asynchronen Funktionen
    //    ab ES2015
    //    vergleiche Task<> bei C# und Mono<> aus Project Reactor
    // Status eines Promise:
    //    Pending: das Resultat ist noch nicht vorhanden, weil die asynchrone
    //             Operation noch nicht abgeschlossen ist
    //    Fulfilled: die asynchrone Operation ist abgeschlossen und
    //               das Promise-Objekt hat einen Wert
    //    Rejected: die asynchrone Operation ist fehlgeschlagen and das
    //              Promise-Objekt wird nicht den Status "fulfilled" erreichen.
    //              Im Promise-Objekt ist dann die Fehlerursache enthalten.

    /**
     * Ein Monitor asynchron anhand seiner ID suchen
     * @param id ID des gesuchten Monitores
     * @returns Das gefundene Monitor vom Typ [Monitor](monitor_entity_monitor_entity.Monitor.html) oder undefined
     *          in einem Promise aus ES2015 (vgl.: Mono aus Project Reactor oder
     *          Future aus Java)
     */
    async findById(id: string) {
        this.#logger.debug('findById: id=%s', id);

        if (!this.#validationService.validateId(id)) {
            this.#logger.debug('findById: Ungueltige ID');
            return;
        }

        // https://typeorm.io/working-with-repository
        // Das Resultat ist undefined, falls kein Datensatz gefunden
        // Lesen: Keine Transaktion erforderlich
        const monitor = await this.#queryBuilder.buildId(id).getOne();
        if (monitor === null) {
            this.#logger.debug('findById: Kein Monitor gefunden');
            return;
        }

        this.#logger.debug('findById: monitor=%o', monitor);
        return monitor;
    }

    /**
     * Monitore asynchron suchen.
     * @param suchkriterien JSON-Objekt mit Suchkriterien
     * @returns Ein JSON-Array mit den gefundenen Monitoren. Ggf. ist das Array leer.
     */
    async find(suchkriterien?: Suchkriterien) {
        this.#logger.debug('find: suchkriterien=%o', suchkriterien);

        // Keine Suchkriterien?
        if (suchkriterien === undefined) {
            return this.#findAll();
        }
        const keys = Object.keys(suchkriterien);
        if (keys.length === 0) {
            return this.#findAll();
        }

        // Falsche Namen fuer Suchkriterien?
        if (!this.#checkKeys(keys)) {
            return [];
        }

        // QueryBuilder https://typeorm.io/select-query-builder
        // Das Resultat ist eine leere Liste, falls nichts gefunden
        // Lesen: Keine Transaktion erforderlich
        const monitore = await this.#queryBuilder
            .build(suchkriterien)
            .getMany();
        this.#logger.debug('find: monitore=%o', monitore);

        return monitore;
    }

    async #findAll() {
        const monitore = await this.#repo.find();
        this.#logger.debug('#findAll: alle monitore=%o', monitore);
        return monitore;
    }

    #checkKeys(keys: string[]) {
        // Ist jedes Suchkriterium auch eine Property von Monitor oder "schlagwoerter"?
        let validKeys = true;
        keys.forEach((key) => {
            if (
                !this.#monitorProps.includes(key) &&
                key !== 'javascript' &&
                key !== 'typescript'
            ) {
                this.#logger.debug(
                    '#find: ungueltiges Suchkriterium "%s"',
                    key,
                );
                validKeys = false;
            }
        });

        return validKeys;
    }
}
