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
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { type CreateError, type UpdateError } from '../service/errors.js';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { type IdInput } from './monitor-query.resolver.js';
import { JwtAuthGraphQlGuard } from '../../security/auth/jwt/jwt-auth-graphql.guard.js';
import { type Monitor } from '../entity/monitor.entity.js';
import { MonitorWriteService } from '../service/monitor-write.service.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { Roles } from '../../security/auth/roles/roles.decorator.js';
import { RolesGraphQlGuard } from '../../security/auth/roles/roles-graphql.guard.js';
import { type Schlagwort } from '../entity/schlagwort.entity.js';
import { UserInputError } from 'apollo-server-express';
import { getLogger } from '../../logger/logger.js';

type MonitorCreateDTO = Omit<
    Monitor,
    'aktualisiert' | 'erzeugt' | 'id' | 'schlagwoerter' | 'version'
> & { schlagwoerter: string[] };
type MonitorUpdateDTO = Omit<
    Monitor,
    'aktualisiert' | 'erzeugt' | 'schlagwoerter'
>;

// Authentifizierung und Autorisierung durch
//  GraphQL Shield
//      https://www.graphql-shield.com
//      https://github.com/maticzav/graphql-shield
//      https://github.com/nestjs/graphql/issues/92
//      https://github.com/maticzav/graphql-shield/issues/213
//  GraphQL AuthZ
//      https://github.com/AstrumU/graphql-authz
//      https://www.the-guild.dev/blog/graphql-authz

@Resolver()
// alternativ: globale Aktivierung der Guards https://docs.nestjs.com/security/authorization#basic-rbac-implementation
@UseGuards(JwtAuthGraphQlGuard, RolesGraphQlGuard)
@UseInterceptors(ResponseTimeInterceptor)
export class MonitorMutationResolver {
    readonly #service: MonitorWriteService;

    readonly #logger = getLogger(MonitorMutationResolver.name);

    constructor(service: MonitorWriteService) {
        this.#service = service;
    }

    @Mutation()
    @Roles('admin', 'mitarbeiter')
    async create(@Args('input') monitorDTO: MonitorCreateDTO) {
        this.#logger.debug('create: monitorDTO=%o', monitorDTO);

        const result = await this.#service.create(
            this.#dtoToMonitor(monitorDTO),
        );
        this.#logger.debug('createMonitor: result=%o', result);

        if (Object.prototype.hasOwnProperty.call(result, 'type')) {
            // UserInputError liefert Statuscode 200
            throw new UserInputError(
                this.#errorMsgCreateMonitor(result as CreateError),
            );
        }
        return result;
    }

    @Mutation()
    @Roles('admin', 'mitarbeiter')
    async update(@Args('input') monitor: MonitorUpdateDTO): Promise<number> {
        this.#logger.debug('update: monitor=%o', monitor);
        const versionStr = `"${monitor.version?.toString()}"`;

        const result = await this.#service.update(
            monitor.id,
            monitor as Monitor,
            versionStr,
        );
        if (typeof result === 'object') {
            throw new UserInputError(this.#errorMsgUpdateMonitor(result));
        }
        this.#logger.debug('updateMonitor: result=%d', result);
        return result;
    }

    @Mutation()
    @Roles('admin')
    async delete(@Args() id: IdInput): Promise<boolean> {
        const idStr = id.id;
        this.#logger.debug('delete: id=%s', idStr);
        const result = await this.#service.delete(idStr);
        this.#logger.debug('deleteMonitor: result=%s', result);
        return result;
    }

    #dtoToMonitor(monitorDTO: MonitorCreateDTO): Monitor {
        const monitor: Monitor = {
            id: undefined,
            version: undefined,
            name: monitorDTO.name,
            hersteller: monitorDTO.hersteller,
            preis: monitorDTO.preis,
            bestand: monitorDTO.bestand,
            curved: monitorDTO.curved,
            refreshrate: monitorDTO.refreshrate,
            release: monitorDTO.release,
            schlagwoerter: [],
            erzeugt: undefined,
            aktualisiert: undefined,
        };

        monitorDTO.schlagwoerter.forEach((s: string) => {
            const schlagwort: Schlagwort = {
                id: undefined,
                schlagwort: s,
                monitor,
            };
            monitor.schlagwoerter.push(schlagwort);
        });

        return monitor;
    }

    #errorMsgCreateMonitor(err: CreateError): string {
        switch (err.type) {
            case 'ConstraintViolations': {
                return err.messages.join(' ');
            }
            case 'NameExists': {
                return `Der Name "${err.name}" existiert bereits`;
            }
            default: {
                return 'Unbekannter Fehler';
            }
        }
    }

    #errorMsgUpdateMonitor(err: UpdateError): string {
        switch (err.type) {
            case 'ConstraintViolations': {
                return err.messages.join(' ');
            }
            case 'NameExists': {
                return `Der Name "${err.name}" existiert bereits`;
            }
            case 'MonitorNotExists': {
                return `Es gibt kein Monitor mit der ID ${err.id}`;
            }
            case 'VersionInvalid': {
                return `"${err.version}" ist keine gueltige Versionsnummer`;
            }
            case 'VersionOutdated': {
                return `Die Versionsnummer "${err.version}" ist nicht mehr aktuell`;
            }
            default: {
                return 'Unbekannter Fehler';
            }
        }
    }
}
