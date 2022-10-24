/* eslint-disable @typescript-eslint/no-non-null-assertion */
/*
 * Copyright (C) 2020 - present Juergen Zimmermann, Hochschule Karlsruhe
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
import { type Monitor } from '../../monitor/entity/monitor.entity.js';
import { type Schlagwort } from './../../monitor/entity/schlagwort.entity.js';

// TypeORM kann keine SQL-Skripte ausfuehren

export const monitore: Monitor[] = [
    // -------------------------------------------------------------------------
    // L e s e n
    // -------------------------------------------------------------------------
    {
        id: '00000000-0000-0000-0000-000000000001',
        version: 0,
        name: 'Alpha',
        hersteller: 'Torvalds',
        preis: 499.99,
        bestand: 12,
        curved: false,
        refreshRate: '60',
        release: new Date('2022-02-01'),
        schlagwoerter: [],
        erzeugt: new Date('2022-02-01'),
        aktualisiert: new Date('2022-02-01'),
    },
    {
        id: '00000000-0000-0000-0000-000000000002',
        version: 0,
        name: 'Beta',
        hersteller: 'Gosloing',
        preis: 1999.99,
        bestand: 24,
        curved: true,
        refreshRate: '144',
        release: new Date('2022-02-02'),
        schlagwoerter: [],
        erzeugt: new Date('2022-02-02'),
        aktualisiert: new Date('2022-02-02'),
    },
    {
        id: '00000000-0000-0000-0000-000000000003',
        version: 0,
        name: 'Gamma',
        hersteller: 'Turing',
        preis: 99.79,
        bestand: 48,
        curved: true,
        refreshRate: '144',
        release: new Date('2022-02-03'),
        schlagwoerter: [],
        erzeugt: new Date('2022-02-03'),
        aktualisiert: new Date('2022-02-03'),
    },
    // -------------------------------------------------------------------------
    // A e n d e r n
    // -------------------------------------------------------------------------
    {
        id: '00000000-0000-0000-0000-000000000040',
        version: 0,
        name: 'Delta',
        hersteller: 'Neumann',
        preis: 100,
        bestand: 96,
        curved: true,
        refreshRate: '240',
        release: new Date('2022-02-04'),
        schlagwoerter: [],
        erzeugt: new Date('2022-02-04'),
        aktualisiert: new Date('2022-02-04'),
    },
    // -------------------------------------------------------------------------
    // L o e s c h e n
    // -------------------------------------------------------------------------
    {
        id: '00000000-0000-0000-0000-000000000500',
        version: 0,
        name: 'Epsilon',
        hersteller: 'Stallman',
        preis: 100,
        bestand: 192,
        curved: true,
        refreshRate: '60',
        release: new Date('2022-02-05'),
        schlagwoerter: [],
        erzeugt: new Date('2022-02-05'),
        aktualisiert: new Date('2022-02-05'),
    },
    {
        id: '00000000-0000-0000-0000-000000000600',
        version: 0,
        name: 'Phi',
        hersteller: 'Turing',
        preis: 2.99,
        bestand: 384,
        curved: false,
        refreshRate: '120',
        release: new Date('2022-02-06'),
        schlagwoerter: [],
        erzeugt: new Date('2022-02-06'),
        aktualisiert: new Date('2022-02-06'),
    },
];

export const schlagwoerter: Schlagwort[] = [
    {
        id: '00000000-0000-0000-0000-010000000001',
        monitor: monitore[0],
        schlagwort: 'highres',
    },
    {
        id: '00000000-0000-0000-0000-020000000001',
        monitor: monitore[1],
        schlagwort: 'slim',
    },
    {
        id: '00000000-0000-0000-0000-030000000001',
        monitor: monitore[2],
        schlagwort: 'highres',
    },
    {
        id: '00000000-0000-0000-0000-030000000002',
        monitor: monitore[2],
        schlagwort: 'slim',
    },
    {
        id: '00000000-0000-0000-0000-500000000001',
        monitor: monitore[4],
        schlagwort: 'slim',
    },
    {
        id: '00000000-0000-0000-0000-600000000001',
        monitor: monitore[5],
        schlagwort: 'slim',
    },
];

monitore[0]!.schlagwoerter.push(schlagwoerter[0]!);
monitore[1]!.schlagwoerter.push(schlagwoerter[1]!);
monitore[2]!.schlagwoerter.push(schlagwoerter[2]!, schlagwoerter[3]!);
monitore[4]!.schlagwoerter.push(schlagwoerter[4]!);
monitore[5]!.schlagwoerter.push(schlagwoerter[5]!);

/* eslint-enable @typescript-eslint/no-non-null-assertion */
