/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-extra-non-null-assertion */
/*
 * Copyright (C) 2021 - present Juergen Zimmermann, Hochschule Karlsruhe
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

import { type GraphQLRequest, type GraphQLResponse } from 'apollo-server-types';
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
import { type MonitorDTO } from '../../src/monitor/graphql/monitor-query.resolver.js';
import each from 'jest-each';

// -----------------------------------------------------------------------------
// T e s t d a t e n
// -----------------------------------------------------------------------------
const idVorhanden = [
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
];

const nameVorhanden = ['Alpha', 'Beta', 'Gamma'];

const teilNameVorhanden = ['a', 't', 'g'];

const teilNameNichtVorhanden = ['Xyz', 'abc'];

// -----------------------------------------------------------------------------
// T e s t s
// -----------------------------------------------------------------------------
// Test-Suite
// eslint-disable-next-line max-lines-per-function
describe('GraphQL Queries', () => {
    let client: AxiosInstance;
    const graphqlPath = 'graphql';

    // Testserver starten und dabei mit der DB verbinden
    beforeAll(async () => {
        await startServer();
        const baseURL = `https://${host}:${port}/`;
        client = axios.create({
            baseURL,
            httpsAgent,
        });
    });

    afterAll(async () => {
        await shutdownServer();
    });

    each(idVorhanden).test(
        'Monitor zu vorhandener ID %s',
        async (id: string) => {
            // given
            const body: GraphQLRequest = {
                query: `
                    {
                        monitor(id: "${id}") {
                            name
                            hersteller
                            preis
                            version
                    }
                }
            `,
            };

            // when
            const response: AxiosResponse<GraphQLResponse> = await client.post(
                graphqlPath,
                body,
            );

            // then
            const { status, headers, data } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(headers['content-type']).toMatch(/json/iu);
            expect(data.errors).toBeUndefined();
            expect(data.data).toBeDefined();

            const { monitor } = data.data!;
            const result: MonitorDTO = monitor;

            expect(result.name).toMatch(/^\w/u);
            expect(result.version).toBeGreaterThan(-1);
            expect(result.id).toBeUndefined();
        },
    );

    test('Monitor zu nicht-vorhandener ID', async () => {
        // given
        const id = '999999999999999999999999';
        const body: GraphQLRequest = {
            query: `
                {
                    monitor(id: "${id}") {
                        name
                    }
                }
            `,
        };

        // when
        const response: AxiosResponse<GraphQLResponse> = await client.post(
            graphqlPath,
            body,
        );

        // then
        const { status, headers, data } = response;

        expect(status).toBe(HttpStatus.OK);
        expect(headers['content-type']).toMatch(/json/iu);
        expect(data.data!.monitor).toBeNull();

        const { errors } = data;

        expect(errors).toHaveLength(1);

        const [error] = errors!;
        const { message, path, extensions } = error!;

        expect(message).toBe(
            `Es wurde kein Monitor mit der ID ${id} gefunden.`,
        );
        expect(path).toBeDefined();
        expect(path!![0]).toBe('monitor');
        expect(extensions).toBeDefined();
        expect(extensions!.code).toBe('BAD_USER_INPUT');
    });

    each(nameVorhanden).test(
        'Monitor zu vorhandenem Namen %s',
        async (name: string) => {
            // given
            const body: GraphQLRequest = {
                query: `
                    {
                        monitore(name: "${name}") {
                            name
                            hersteller
                        }
                    }
                `,
            };

            // when
            const response: AxiosResponse<GraphQLResponse> = await client.post(
                graphqlPath,
                body,
            );

            // then
            const { status, headers, data } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(headers['content-type']).toMatch(/json/iu);
            expect(data.errors).toBeUndefined();

            expect(data.data).toBeDefined();

            const { monitore } = data.data!;

            expect(monitore).not.toHaveLength(0);

            const monitoreArray: MonitorDTO[] = monitore;

            expect(monitoreArray).toHaveLength(1);

            const [monitor] = monitoreArray;

            expect(monitor!.name).toBe(name);
        },
    );

    each(teilNameVorhanden).test(
        'Monitor zu vorhandenem Teil-Namen %s',
        async (teilName: string) => {
            // given
            const body: GraphQLRequest = {
                query: `
                    {
                        monitore(name: "${teilName}") {
                            name
                            hersteller
                        }
                    }
                `,
            };

            // when
            const response: AxiosResponse<GraphQLResponse> = await client.post(
                graphqlPath,
                body,
            );

            // then
            const { status, headers, data } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(headers['content-type']).toMatch(/json/iu);
            expect(data.errors).toBeUndefined();
            expect(data.data).toBeDefined();

            const { monitore } = data.data!;

            expect(monitore).not.toHaveLength(0);

            const monitoreArray: MonitorDTO[] = monitore;
            monitoreArray
                .map((monitor) => monitor.name)
                .forEach((name: string) =>
                    expect(name.toLowerCase()).toEqual(
                        expect.stringContaining(teilName),
                    ),
                );
        },
    );

    each(teilNameNichtVorhanden).test(
        'Monitor zu nicht vorhandenem Namen %s',
        async (teilName: string) => {
            // given
            const body: GraphQLRequest = {
                query: `
                    {
                        monitore(name: "${teilName}") {
                            name
                            hersteller
                        }
                    }
                `,
            };

            // when
            const response: AxiosResponse<GraphQLResponse> = await client.post(
                graphqlPath,
                body,
            );

            // then
            const { status, headers, data } = response;

            expect(status).toBe(HttpStatus.OK);
            expect(headers['content-type']).toMatch(/json/iu);
            expect(data.data!.monitore).toBeNull();

            const { errors } = data;

            expect(errors).toHaveLength(1);

            const [error] = errors!;
            const { message, path, extensions } = error!;

            expect(message).toBe('Es wurden keine Monitore gefunden.');
            expect(path).toBeDefined();
            expect(path!![0]).toBe('monitore');
            expect(extensions).toBeDefined();
            expect(extensions!.code).toBe('BAD_USER_INPUT');
        },
    );
});
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-extra-non-null-assertion */
