/*
 * Copyright (C) 2021 - present Juergen Zimmermann, Florian Goebel, Hochschule Karlsruhe
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
 * Das Modul enthält die Funktion, um die Test-DB neu zu laden.
 * @packageDocumentation
 */

import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { dbPopulate, typeOrmModuleOptions } from '../db.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Monitor } from '../../monitor/entity/monitor.entity.js';
import { Repository } from 'typeorm';
import { Schlagwort } from '../../monitor/entity/schlagwort.entity.js';
import { configDir } from '../node.js';
import { getLogger } from '../../logger/logger.js';
import { monitore } from './testdaten.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Die Test-DB wird im Development-Modus neu geladen, nachdem die Module
 * initialisiert sind, was duch `OnApplicationBootstrap` realisiert wird.
 */
@Injectable()
export class DbPopulateService implements OnApplicationBootstrap {
    readonly #repo: Repository<Monitor>;

    readonly #logger = getLogger(DbPopulateService.name);

    readonly #monitore = monitore;

    /**
     * Initialisierung durch DI mit `Repository<Monitor>` gemäß _TypeORM_.
     */
    constructor(@InjectRepository(Monitor) repo: Repository<Monitor>) {
        this.#repo = repo;
    }

    /**
     * Die Test-DB wird im Development-Modus neu geladen.
     */
    async onApplicationBootstrap() {
        await this.populateTestdaten();
    }

    async populateTestdaten() {
        if (!dbPopulate) {
            return;
        }

        await (typeOrmModuleOptions.type === 'postgres'
            ? this.#populatePostgres()
            : this.#populateMySQL());
    }

    async #populatePostgres() {
        const schema = Monitor.name.toLowerCase();
        this.#logger.warn(
            `${typeOrmModuleOptions.type}: Schema ${schema} wird geloescht`,
        );
        await this.#repo.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE;`);

        const filename = 'create-table.sql';
        const createScript = resolve(
            configDir,
            'dev',
            typeOrmModuleOptions.type!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
            filename,
        );
        // https://nodejs.org/api/fs.html#fs_fs_readfilesync_path_options
        const sql = readFileSync(createScript, 'utf8');
        await this.#repo.query(sql);

        const saved = await this.#repo.save(this.#monitore);
        this.#logger.warn(
            '#populatePostgres: %d Datensaetze eingefuegt',
            saved.length,
        );
    }

    async #populateMySQL() {
        let tabelle = Schlagwort.name.toLowerCase();
        this.#logger.warn(
            `${typeOrmModuleOptions.type}: Tabelle ${tabelle} wird geloescht`,
        );
        await this.#repo.query(
            `DROP TABLE IF EXISTS ${Schlagwort.name.toLowerCase()};`,
        );

        tabelle = Monitor.name.toLowerCase();
        this.#logger.warn(
            `${typeOrmModuleOptions.type}: Tabelle ${tabelle} wird geloescht`,
        );
        await this.#repo.query(
            `DROP TABLE IF EXISTS ${Monitor.name.toLowerCase()};`,
        );

        const scriptDir = resolve(configDir, 'dev', typeOrmModuleOptions.type!); // eslint-disable-line @typescript-eslint/no-non-null-assertion
        let createScript = resolve(scriptDir, 'create-table-monitor.sql');
        let sql = readFileSync(createScript, 'utf8');
        await this.#repo.query(sql);
        createScript = resolve(scriptDir, 'create-table-schlagwort.sql');
        sql = readFileSync(createScript, 'utf8');
        await this.#repo.query(sql);

        const saved = await this.#repo.save(this.#monitore);
        this.#logger.warn(
            '#populateMySQL: %d Datensaetze eingefuegt',
            saved.length,
        );
    }
}
