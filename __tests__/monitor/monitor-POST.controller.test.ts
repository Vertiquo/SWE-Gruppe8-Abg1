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

import { afterAll, beforeAll, describe, test } from '@jest/globals';
import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import {
    host,
    httpsAgent,
    port,
    shutdownServer,
    startServer,
} from '../testserver.js';
import { HttpStatus } from '@nestjs/common';
import { ID_PATTERN } from '../../src/monitor/service/monitor-validation.service.js';
import { type MonitorDTO } from '../../src/monitor/rest/monitor-write.controller.js';
import { loginRest } from '../login.js';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const neuerMonitor: MonitorDTO = {
    name: 'Testrest',
    hersteller: 'MyHersteller',
    preis: 99.99,
    bestand: 5,
    curved: true,
    refreshrate: 'Hz144',
    release: '2022-01-31',
    schlagwoerter: ['highres', 'slim'],
};
const neuerMonitorInvalid: Record<string, unknown> = {
    name: '!?$',
    hersteller: '!!!',
    preis: -100.99,
    bestand: 1.2,
    curved: true,
    refreshrate: '123',
    release: '123456123456',
    schlagwoerter: [],
};
const neuerMonitorNameExistiert: MonitorDTO = {
    name: 'Alpha',
    hersteller: 'AlphaHersteller',
    preis: 79.99,
    bestand: 7,
    curved: false,
    refreshrate: 'Hz120',
    release: '2022-01-31',
    schlagwoerter: ['highres', 'slim'],
};

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
// eslint-disable-next-line max-lines-per-function
describe('POST /', () => {
    let client: AxiosInstance;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json', // eslint-disable-line @typescript-eslint/naming-convention
    };

    // Testserver starten und dabei mit der DB verbinden
    beforeAll(async () => {
        await startServer();
        const baseURL = `https://${host}:${port}`;
        client = axios.create({
            baseURL,
            httpsAgent,
            validateStatus: (status) => status < 500, // eslint-disable-line @typescript-eslint/no-magic-numbers
        });
    });

    // (done?: DoneFn) => Promise<void | undefined | unknown> | void | undefined
    // close(callback?: (err?: Error) => void): this
    afterAll(async () => {
        await shutdownServer();
    });

    test('Neuer Monitor', async () => {
        // given
        const token = await loginRest(client);
        headers.Authorization = `Bearer ${token}`;

        // when
        const response: AxiosResponse<string> = await client.post(
            '/',
            neuerMonitor,
            { headers },
        );

        // then
        const { status, data } = response;

        expect(status).toBe(HttpStatus.CREATED);

        const { location } = response.headers as { location: string };

        expect(location).toBeDefined();

        // ObjectID: Muster von HEX-Ziffern
        const indexLastSlash: number = location.lastIndexOf('/');

        expect(indexLastSlash).not.toBe(-1);

        const idStr = location.slice(indexLastSlash + 1);

        expect(idStr).toBeDefined();
        expect(ID_PATTERN.test(idStr)).toBe(true);

        expect(data).toBe('');
    });

    test('Neuer Monitor mit ungueltigen Daten', async () => {
        // given
        const token = await loginRest(client);
        headers.Authorization = `Bearer ${token}`;

        // when
        const response: AxiosResponse<string> = await client.post(
            '/',
            neuerMonitorInvalid,
            { headers },
        );

        // then
        const { status, data } = response;

        expect(status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        expect(data).toEqual(
            expect.arrayContaining([
                'Der Monitorname muss mit einem Buchstaben, einer Ziffer oder _ beginnen.',
                'Der Herstellername muss mit einem Buchstaben, einer Ziffer oder _ beginnen.',
                'Der Preis darf nicht negativ sein.',
                'Der Bestand darf nicht negativ sein.',
                'Die Bildwiederholungsfrequenz muss einer der folgenden Werte sein: (Hz60 | Hz120 | Hz144 | Hz240).',
                'Das Releasedatum muss im Format yyyy-MM-dd sein.',
            ]),
        );
    });

    test('Neuer Monitor, aber der Name existiert bereits', async () => {
        // given
        const token = await loginRest(client);
        headers.Authorization = `Bearer ${token}`;

        // when
        const response: AxiosResponse<string> = await client.post(
            '/',
            neuerMonitorNameExistiert,
            { headers },
        );

        // then
        const { status, data } = response;

        expect(status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
        expect(data).toEqual(expect.stringContaining('Name'));
    });

    test('Neuer Monitor, aber ohne Token', async () => {
        // when
        const response: AxiosResponse<Record<string, any>> = await client.post(
            '/',
            neuerMonitor,
        );

        // then
        const { status, data } = response;

        expect(status).toBe(HttpStatus.FORBIDDEN);
        expect(data.statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    test('Neuer Monitor, aber mit falschem Token', async () => {
        // given
        const token = 'FALSCH';
        headers.Authorization = `Bearer ${token}`;

        // when
        const response: AxiosResponse<Record<string, any>> = await client.post(
            '/',
            neuerMonitor,
            { headers },
        );

        // then
        const { status, data } = response;

        expect(status).toBe(HttpStatus.FORBIDDEN);
        expect(data.statusCode).toBe(HttpStatus.FORBIDDEN);
    });

    test.todo('Abgelaufener Token');
});
