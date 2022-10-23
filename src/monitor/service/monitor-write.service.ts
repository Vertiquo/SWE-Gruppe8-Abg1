/* eslint-disable max-lines */
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
 * Das Modul besteht aus der Klasse {@linkcode MonitorWriteService} für die
 * Schreiboperationen im Anwendungskern.
 * @packageDocumentation
 */

import { Monitor } from '../entity/monitor.entity.js';
import {
    type CreateError,
    type MonitorNotExists,
    type NameExists,
    type UpdateError,
    type VersionInvalid,
    type VersionOutdated,
} from './errors.js';
import { type DeleteResult, Repository } from 'typeorm';
import { MonitorReadService } from './monitor-read.service.js';
import { MonitorValidationService } from './monitor-validation.service.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { MailService } from '../../mail/mail.service.js';
import RE2 from 're2';
import { Schlagwort } from '../entity/schlagwort.entity.js';
import { getLogger } from '../../logger/logger.js';
import { v4 as uuid } from 'uuid';

/**
 * Die Klasse `MonitorWriteService` implementiert den Anwendungskern für das
 * Schreiben von Monitoren und greift mit _TypeORM_ auf die DB zu.
 */
@Injectable()
export class MonitorWriteService {
    private static readonly VERSION_PATTERN = new RE2('^"\\d*"');

    readonly #repo: Repository<Monitor>;

    readonly #readService: MonitorReadService;

    readonly #validationService: MonitorValidationService;

    readonly #mailService: MailService;

    readonly #logger = getLogger(MonitorWriteService.name);

    // eslint-disable-next-line max-params
    constructor(
        @InjectRepository(Monitor) repo: Repository<Monitor>,
        readService: MonitorReadService,
        validationService: MonitorValidationService,
        mailService: MailService,
    ) {
        this.#repo = repo;
        this.#readService = readService;
        this.#validationService = validationService;
        this.#mailService = mailService;
    }

    /**
     * Ein neues Monitor soll angelegt werden.
     * @param monitor Das neu abzulegende Monitor
     * @returns Die ID des neu angelegten Monitores oder im Fehlerfall
     * [CreateError](../types/monitor_service_errors.CreateError.html)
     */
    async create(monitor: Monitor): Promise<CreateError | string> {
        this.#logger.debug('create: monitor=%o', monitor);
        const validateResult = await this.#validateCreate(monitor);
        if (validateResult !== undefined) {
            return validateResult;
        }

        monitor.id = uuid(); // eslint-disable-line require-atomic-updates
        monitor.schlagwoerter.forEach((schlagwort) => {
            schlagwort.id = uuid();
        });

        // implizite Transaktion
        const monitorDb = await this.#repo.save(monitor); // implizite Transaktion
        this.#logger.debug('create: monitorDb=%o', monitorDb);

        await this.#sendmail(monitorDb);

        return monitorDb.id!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    }

    /**
     * Ein vorhandenes Monitor soll aktualisiert werden.
     * @param monitor Das zu aktualisierende Monitor
     * @param id ID des zu aktualisierenden Monitors
     * @param version Die Versionsnummer für optimistische Synchronisation
     * @returns Die neue Versionsnummer gemäß optimistischer Synchronisation
     *  oder im Fehlerfall [UpdateError](../types/monitor_service_errors.UpdateError.html)
     */
    async update(
        id: string | undefined,
        monitor: Monitor,
        version: string,
    ): Promise<UpdateError | number> {
        this.#logger.debug(
            'update: id=%s, monitor=%o, version=%s',
            id,
            monitor,
            version,
        );
        if (id === undefined || !this.#validationService.validateId(id)) {
            this.#logger.debug('update: Keine gueltige ID');
            return { type: 'MonitorNotExists', id };
        }

        const validateResult = await this.#validateUpdate(monitor, id, version);
        this.#logger.debug('update: validateResult=%o', validateResult);
        if (!(validateResult instanceof Monitor)) {
            return validateResult;
        }

        const monitorNeu = validateResult;
        const merged = this.#repo.merge(monitorNeu, monitor);
        this.#logger.debug('update: merged=%o', merged);
        const updated = await this.#repo.save(merged); // implizite Transaktion
        this.#logger.debug('update: updated=%o', updated);

        return updated.version!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    }

    /**
     * Ein Monitor wird asynchron anhand seiner ID gelöscht.
     *
     * @param id ID des zu löschenden Monitores
     * @returns true, falls das Monitor vorhanden war und gelöscht wurde. Sonst false.
     */
    async delete(id: string) {
        this.#logger.debug('delete: id=%s', id);
        if (!this.#validationService.validateId(id)) {
            this.#logger.debug('delete: Keine gueltige ID');
            return false;
        }

        const monitor = await this.#readService.findById(id);
        if (monitor === undefined) {
            return false;
        }

        let deleteResult: DeleteResult | undefined;
        await this.#repo.manager.transaction(async (transactionalMgr) => {
            // Das Monitor zur gegebenen ID asynchron loeschen
            const { schlagwoerter } = monitor;
            const schlagwoerterIds = schlagwoerter.map(
                (schlagwort) => schlagwort.id,
            );
            const deleteResultSchlagwoerter = await transactionalMgr.delete(
                Schlagwort,
                schlagwoerterIds,
            );
            this.#logger.debug(
                'delete: deleteResultSchlagwoerter=%o',
                deleteResultSchlagwoerter,
            );
            deleteResult = await transactionalMgr.delete(Monitor, id);
            this.#logger.debug('delete: deleteResult=%o', deleteResult);
        });

        return (
            deleteResult?.affected !== undefined &&
            deleteResult.affected !== null &&
            deleteResult.affected > 0
        );
    }

    async #validateCreate(monitor: Monitor): Promise<CreateError | undefined> {
        const validateResult = this.#validationService.validate(monitor);
        if (validateResult !== undefined) {
            const messages = validateResult;
            this.#logger.debug('#validateCreate: messages=%o', messages);
            return { type: 'ConstraintViolations', messages };
        }

        const { name } = monitor;
        let monitore = await this.#readService.find({ name: name }); // eslint-disable-line object-shorthand
        if (monitore.length > 0) {
            return { type: 'NameExists', name };
        }

        const { hersteller } = monitor;
        monitore = await this.#readService.find({ hersteller: hersteller }); // eslint-disable-line object-shorthand
        if (monitore.length > 0) {
            return { type: 'HerstellerExists', hersteller };
        }

        this.#logger.debug('#validateCreate: ok');
        return undefined;
    }

    async #sendmail(monitor: Monitor) {
        const subject = `Neues Monitor ${monitor.id}`;
        const body = `Das Monitor mit dem Name <strong>${monitor.name}</strong> ist angelegt`;
        await this.#mailService.sendmail(subject, body);
    }

    async #validateUpdate(
        monitor: Monitor,
        id: string,
        versionStr: string,
    ): Promise<Monitor | UpdateError> {
        const result = this.#validateVersion(versionStr);
        if (typeof result !== 'number') {
            return result;
        }

        const version = result;
        this.#logger.debug(
            '#validateUpdate: monitor=%o, version=%s',
            monitor,
            version,
        );

        const validateResult = this.#validationService.validate(monitor);
        if (validateResult !== undefined) {
            const messages = validateResult;
            this.#logger.debug('#validateUpdate: messages=%o', messages);
            return { type: 'ConstraintViolations', messages };
        }

        const resultName = await this.#checkNameExists(monitor);
        if (resultName !== undefined && resultName.id !== id) {
            return resultName;
        }

        const resultFindById = await this.#findByIdAndCheckVersion(id, version);
        this.#logger.debug('#validateUpdate: %o', resultFindById);
        return resultFindById;
    }

    #validateVersion(version: string | undefined): VersionInvalid | number {
        if (
            version === undefined ||
            !MonitorWriteService.VERSION_PATTERN.test(version)
        ) {
            const error: VersionInvalid = { type: 'VersionInvalid', version };
            this.#logger.debug('#validateVersion: VersionInvalid=%o', error);
            return error;
        }

        return Number.parseInt(version.slice(1, -1), 10);
    }

    async #checkNameExists(monitor: Monitor): Promise<NameExists | undefined> {
        const { name } = monitor;

        const monitore = await this.#readService.find({ name: name }); // eslint-disable-line object-shorthand
        if (monitore.length > 0) {
            const [gefundenerMonitor] = monitore;
            const { id } = gefundenerMonitor!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
            this.#logger.debug('#checkNameExists: id=%s', id);
            return { type: 'NameExists', name, id: id! }; // eslint-disable-line @typescript-eslint/no-non-null-assertion
        }

        this.#logger.debug('#checkNameExists: ok');
        return undefined;
    }

    async #findByIdAndCheckVersion(
        id: string,
        version: number,
    ): Promise<Monitor | MonitorNotExists | VersionOutdated> {
        const monitorDb = await this.#readService.findById(id);
        if (monitorDb === undefined) {
            const result: MonitorNotExists = { type: 'MonitorNotExists', id };
            this.#logger.debug(
                '#checkIdAndVersion: MonitorNotExists=%o',
                result,
            );
            return result;
        }

        // nullish coalescing
        const versionDb = monitorDb.version!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
        if (version < versionDb) {
            const result: VersionOutdated = {
                type: 'VersionOutdated',
                id,
                version,
            };
            this.#logger.debug(
                '#checkIdAndVersion: VersionOutdated=%o',
                result,
            );
            return result;
        }

        return monitorDb;
    }
}
/* eslint-enable max-lines */
