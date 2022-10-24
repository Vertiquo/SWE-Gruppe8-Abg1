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
 * Das Modul besteht aus der Klasse {@linkcode QueryBuilder}.
 * @packageDocumentation
 */

import { FindOptionsUtils, Repository, type SelectQueryBuilder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Monitor } from '../entity/monitor.entity.js';
import { getLogger } from '../../logger/logger.js';
import { typeOrmModuleOptions } from '../../config/db.js';

/**
 * Die Klasse `QueryBuilder` implementiert das Lesen für Bücher und greift
 * mit _TypeORM_ auf eine relationale DB zu.
 */
@Injectable()
export class QueryBuilder {
    readonly #monitorAlias = `${Monitor.name
        .charAt(0)
        .toLowerCase()}${Monitor.name.slice(1)}`;

    readonly #repo: Repository<Monitor>;

    readonly #logger = getLogger(QueryBuilder.name);

    constructor(@InjectRepository(Monitor) repo: Repository<Monitor>) {
        this.#repo = repo;
    }

    /**
     * Ein Monitor mit der ID suchen.
     * @param id ID des gesuchten Monitores
     * @returns QueryBuilder
     */
    buildId(id: string) {
        const queryBuilder = this.#repo.createQueryBuilder(this.#monitorAlias);
        // Option { eager: true } in der Entity-Klasse wird nur bei find-Methoden des Repositories beruecksichtigt
        // https://github.com/typeorm/typeorm/issues/8292#issuecomment-1036991980
        // https://github.com/typeorm/typeorm/issues/7142
        FindOptionsUtils.joinEagerRelations(
            queryBuilder,
            queryBuilder.alias,
            this.#repo.metadata,
        );

        queryBuilder.where(`${this.#monitorAlias}.id = :id`, { id: id }); // eslint-disable-line object-shorthand
        return queryBuilder;
    }

    /**
     * Bücher asynchron suchen.
     * @param suchkriterien JSON-Objekt mit Suchkriterien
     * @returns QueryBuilder
     */
    build(suchkriterien: Record<string, any>) {
        this.#logger.debug('build: suchkriterien=%o', suchkriterien);

        let queryBuilder = this.#repo.createQueryBuilder(this.#monitorAlias);
        // Option { eager: true } in der Entity-Klasse wird nur bei find-Methoden des Repositories beruecksichtigt
        // https://github.com/typeorm/typeorm/issues/8292#issuecomment-1036991980
        // https://github.com/typeorm/typeorm/issues/7142
        FindOptionsUtils.joinEagerRelations(
            queryBuilder,
            queryBuilder.alias,
            this.#repo.metadata,
        );

        // z.B. { name: 'a', hersteller: 'b', highres: true }
        // Rest Properties fuer anfaengliche WHERE-Klausel
        // type-coverage:ignore-next-line
        const { name, hersteller, highres, slim, ...props } = suchkriterien;

        queryBuilder = this.#buildSchlagwoerter(
            queryBuilder,
            highres, // eslint-disable-line @typescript-eslint/no-unsafe-argument
            slim, // eslint-disable-line @typescript-eslint/no-unsafe-argument
        );

        let useWhere = true;

        // Titel in der Query: Teilstring des Titels und "case insensitive"
        // CAVEAT: MySQL hat keinen Vergleich mit "case insensitive"
        // type-coverage:ignore-next-line
        if (name !== undefined && typeof name === 'string') {
            const ilike =
                typeOrmModuleOptions.type === 'postgres' ? 'ilike' : 'like';
            queryBuilder = queryBuilder.where(
                `${this.#monitorAlias}.name ${ilike} :name`,
                { name: `%${name}%` },
            );
            useWhere = false;
        }

        // Restliche Properties als Key-Value-Paare: Vergleiche auf Gleichheit
        Object.keys(props).forEach((key) => {
            const param: Record<string, any> = {};
            param[key] = props[key]; // eslint-disable-line @typescript-eslint/no-unsafe-assignment, security/detect-object-injection
            queryBuilder = useWhere
                ? queryBuilder.where(
                      `${this.#monitorAlias}.${key} = :${key}`,
                      param,
                  )
                : queryBuilder.andWhere(
                      `${this.#monitorAlias}.${key} = :${key}`,
                      param,
                  );
        });

        this.#logger.debug('build: sql=%s', queryBuilder.getSql());
        return queryBuilder;
    }

    #buildSchlagwoerter(
        queryBuilder: SelectQueryBuilder<Monitor>,
        highres: string | undefined,
        slim: string | undefined,
    ) {
        // Schlagwort 'highres'
        if (highres === 'true') {
            // https://typeorm.io/select-query-builder#inner-and-left-joins
            // eslint-disable-next-line no-param-reassign
            queryBuilder = queryBuilder.innerJoinAndSelect(
                `${this.#monitorAlias}.schlagwoerter`,
                'swHR',
                'swHR.schlagwort = :highres',
                { highres: 'HIGHRES' },
            );
        }
        // Schlagwort 'slim'
        if (slim === 'true') {
            // eslint-disable-next-line no-param-reassign
            queryBuilder = queryBuilder.innerJoinAndSelect(
                `${this.#monitorAlias}.schlagwoerter`,
                'swSlim',
                'swSlim.schlagwort = :slim',
                { slim: 'SLIM' },
            );
        }
        return queryBuilder;
    }
}
