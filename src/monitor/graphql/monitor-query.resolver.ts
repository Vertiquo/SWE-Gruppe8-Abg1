/** Copyright (C) 2021 - present Juergen Zimmermann, Hochschule Karlsruhe
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
import { Args, Query, Resolver } from '@nestjs/graphql';
import { type Monitor } from '../entity/monitor.entity.js';
import { MonitorReadService } from '../service/monitor-read.service.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { UseInterceptors } from '@nestjs/common';
import { UserInputError } from 'apollo-server-express';
import { getLogger } from '../../logger/logger.js';

export type MonitorDTO = Omit<
    Monitor,
    'aktualisiert' | 'erzeugt' | 'schlagwoerter'
> & { schlagwoerter: string[] };
export interface IdInput {
    id: string;
}

@Resolver()
@UseInterceptors(ResponseTimeInterceptor)
export class MonitorhQueryResolver {
    readonly #service: MonitorReadService;

    readonly #logger: Logger<any> = getLogger(MonitorQueryResolver.name);

    constructor(service: MonitorReadService) {
        this.#service = service;
    }

    @Query('monitor')
    async findById(@Args() id: IdInput): Promise<MonitorDTO> {
        const idStr: string = id.id;
        this.#logger.debug('findById: id=%s', idStr);

        const monitor: Monitor | undefined = await this.#service.findById(
            idStr,
        );
        if (monitor === undefined) {
            // UserInputError liefert Statuscode 200
            // Weitere Error-Klasse in apollo-server-errors:
            // SyntaxError, ValidationError, AuthenticationError, ForbiddenError,
            // PersistedQuery, PersistedQuery
            // https://www.apollographql.com/blog/graphql/error-handling/full-stack-error-handling-with-graphql-apollo
            throw new UserInputError(
                `Es wurde kein Monitor mit der ID ${idStr} gefunden.`,
            );
        }
        const monitorDTO = this.#toMonitorDTO(monitor);
        this.#logger.debug('findById: monitorDTO=%o', monitorDTO);
        return monitorDTO;
    }

    @Query('monitore')
    async find(
        @Args() name: { name: string } | undefined,
    ): Promise<MonitorDTO[]> {
        const nameStr: string | undefined = name?.name;
        this.#logger.debug('find: name=%s', nameStr);
        const suchkriterium = nameStr === undefined ? {} : { name: nameStr };
        const monitore: Monitor[] = await this.#service.find(suchkriterium);
        if (monitore.length === 0) {
            // UserInputError liefert Statuscode 200
            throw new UserInputError('Es wurden keine Monitore gefunden.');
        }

        const monitoreDTO: MonitorDTO[] = monitore.map(
            (monitor: Monitor): MonitorDTO => this.#toMonitorDTO(monitor),
        );
        this.#logger.debug('find: monitoreDTO=%o', monitoreDTO);
        return monitoreDTO;
    }

    #toMonitorDTO(monitor: Monitor): MonitorDTO {
        const schlagwoerter: string[] = monitor.schlagwoerter.map(
            (schlagwort): string => schlagwort.schlagwort!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
        );
        const monitorDTO: MonitorDTO = {
            id: monitor.id,
            version: monitor.version,
            name: monitor.name,
            hersteller: monitor.hersteller,
            preis: monitor.preis,
            bestand: monitor.bestand,
            curved: monitor.curved,
            release: monitor.release,
            schlagwoerter,
        };
        return monitorDTO;
    }
}
