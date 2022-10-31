/* eslint-disable max-lines */
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

/**
 * Das Modul besteht aus der Controller-Klasse für Schreiben an der REST-Schnittstelle.
 * @packageDocumentation
 */

import {
    ApiBadRequestResponse,
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiHeader,
    ApiNoContentResponse,
    ApiOperation,
    ApiPreconditionFailedResponse,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import {
    Body,
    Controller,
    Delete,
    Headers,
    HttpStatus,
    Param,
    Post,
    Put,
    Req,
    Res,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { type CreateError, type UpdateError } from '../service/errors.js';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../security/auth/jwt/jwt-auth.guard.js';
import { type Monitor } from '../entity/monitor.entity.js';
import { MonitorWriteService } from '../service/monitor-write.service.js';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { Roles } from '../../security/auth/roles/roles.decorator.js';
import { RolesGuard } from '../../security/auth/roles/roles.guard.js';
import { type Schlagwort } from '../entity/schlagwort.entity.js';
import { getBaseUri } from './getBaseUri.js';
import { getLogger } from '../../logger/logger.js';

export type MonitorDTO = Omit<
    Monitor,
    'aktualisiert' | 'erzeugt' | 'id' | 'schlagwoerter' | 'version'
> & {
    schlagwoerter: string[];
};

export type MonitorUpdateDTO = Omit<
    Monitor,
    'aktualisiert' | 'erzeugt' | 'id' | 'schlagwoerter' | 'version'
>;

/**
 * Die Controller-Klasse für die Verwaltung von Bücher.
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ResponseTimeInterceptor)
@ApiTags('Monitor API')
@ApiBearerAuth()
export class MonitorWriteController {
    readonly #service: MonitorWriteService;

    readonly #logger = getLogger(MonitorWriteController.name);

    constructor(service: MonitorWriteService) {
        this.#service = service;
    }

    /**
     * Ein neuer Monitor wird asynchron angelegt. Der neu anzulegende Monitor ist als
     * JSON-Datensatz im Request-Objekt enthalten. Wenn es keine
     * Verletzungen von Constraints gibt, wird der Statuscode `201` (`Created`)
     * gesetzt und im Response-Header wird `Location` auf die URI so gesetzt,
     * dass damit der neu angelegte Monitor abgerufen werden kann.
     *
     * Falls Constraints verletzt sind, wird der Statuscode `400` (`Bad Request`)
     * gesetzt und genauso auch wenn der Name existiert.
     *
     * @param monitor JSON-Daten für einen Monitor im Request-Body.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    @Post()
    @Roles('admin', 'mitarbeiter')
    @ApiOperation({ summary: 'Einen neuen Monitor anlegen' })
    @ApiCreatedResponse({ description: 'Erfolgreich neu angelegt' })
    @ApiBadRequestResponse({ description: 'Fehlerhafte Monitordaten' })
    async create(
        @Body() monitorDTO: MonitorDTO,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<Response> {
        this.#logger.debug('create: monitorDTO=%o', monitorDTO);

        const result = await this.#service.create(
            this.#dtoToMonitor(monitorDTO),
        );
        if (Object.prototype.hasOwnProperty.call(result, 'type')) {
            return this.#handleCreateError(result as CreateError, res);
        }

        const location = `${getBaseUri(req)}/${result as string}`;
        this.#logger.debug('create: location=%s', location);
        return res.location(location).send();
    }

    /**
     * Ein vorhandener Monitor wird asynchron aktualisiert.
     *
     * Im Request-Objekt von Express muss die ID des zu aktualisierenden Monitors
     * als Pfad-Parameter enthalten sein. Außerdem muss im Rumpf der zu
     * aktualisierende Monitor als JSON-Datensatz enthalten sein. Damit die
     * Aktualisierung überhaupt durchgeführt werden kann, muss im Header
     * `If-Match` auf die korrekte Version für optimistische Synchronisation
     * gesetzt sein.
     *
     * Bei erfolgreicher Aktualisierung wird der Statuscode `204` (`No Content`)
     * gesetzt und im Header auch `ETag` mit der neuen Version mitgeliefert.
     *
     * Falls die Versionsnummer fehlt, wird der Statuscode `428` (`Precondition
     * required`) gesetzt; und falls sie nicht korrekt ist, der Statuscode `412`
     * (`Precondition failed`). Falls Constraints verletzt sind, wird der
     * Statuscode `400` (`Bad Request`) gesetzt und genauso auch wenn der neue
     * Name bereits existiert.
     *
     * @param monitor Monitordaten im Body des Request-Objekts.
     * @param id Pfad-Paramater für die ID.
     * @param version Versionsnummer aus dem Header _If-Match_.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    // eslint-disable-next-line max-params
    @Put(':id')
    @Roles('admin', 'mitarbeiter')
    @ApiOperation({
        summary: 'Einen vorhandenen Monitor aktualisieren',
        tags: ['Aktualisieren'],
    })
    @ApiHeader({
        name: 'If-Match',
        description: 'Header für optimistische Synchronisation',
        required: false,
    })
    @ApiHeader({
        name: 'Authorization',
        description: 'Header für JWT',
        required: true,
    })
    @ApiNoContentResponse({ description: 'Erfolgreich aktualisiert' })
    @ApiBadRequestResponse({ description: 'Fehlerhafte Monitordaten' })
    @ApiPreconditionFailedResponse({
        description: 'Falsche Version im Header "If-Match"',
    })
    @ApiResponse({
        status: HttpStatus.PRECONDITION_REQUIRED,
        description: 'Header "If-Match" fehlt',
    })
    async update(
        @Body() monitorDTO: MonitorUpdateDTO,
        @Param('id') id: string,
        @Headers('If-Match') version: string | undefined,
        @Res() res: Response,
    ): Promise<Response> {
        this.#logger.debug(
            'update: id=%s, monitorDTO=%o, version=%s',
            id,
            monitorDTO,
            version,
        );

        if (version === undefined) {
            const msg = 'Header "If-Match" fehlt';
            this.#logger.debug('#handleUpdateError: msg=%s', msg);
            return res
                .status(HttpStatus.PRECONDITION_REQUIRED)
                .set('Content-Type', 'text/plain')
                .send(msg);
        }

        const result = await this.#service.update(
            id,
            this.#updateDtoToMonitor(monitorDTO),
            version,
        );
        if (typeof result === 'object') {
            return this.#handleUpdateError(result, res);
        }

        this.#logger.debug('update: version=%d', result);
        return res.set('ETag', `"${result}"`).sendStatus(HttpStatus.NO_CONTENT);
    }

    /**
     * Ein Monitor wird anhand seiner ID-gelöscht, die als Pfad-Parameter angegeben
     * ist. Der zurückgelieferte Statuscode ist `204` (`No Content`).
     *
     * @param id Pfad-Paramater für die ID.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    @Delete(':id')
    @Roles('admin')
    @ApiOperation({ summary: 'Monitor mit der ID löschen', tags: ['Loeschen'] })
    @ApiHeader({
        name: 'Authorization',
        description: 'Header für JWT',
        required: true,
    })
    @ApiNoContentResponse({
        description: 'Der Monitor wurde gelöscht oder war nicht vorhanden',
    })
    async delete(
        @Param('id') id: string,
        @Res() res: Response,
    ): Promise<Response<undefined>> {
        this.#logger.debug('delete: id=%s', id);

        try {
            await this.#service.delete(id);
        } catch (err) {
            this.#logger.error('delete: error=%o', err);
            return res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        return res.sendStatus(HttpStatus.NO_CONTENT);
    }

    #dtoToMonitor(monitorDTO: MonitorDTO): Monitor {
        const monitor: Monitor = {
            id: undefined,
            version: undefined,
            name: monitorDTO.name,
            hersteller: monitorDTO.hersteller,
            preis: monitorDTO.preis,
            bestand: monitorDTO.bestand,
            curved: monitorDTO.curved,
            refreshRate: monitorDTO.refreshRate,
            release: monitorDTO.release,
            schlagwoerter: [],
            erzeugt: undefined,
            aktualisiert: undefined,
        };

        // Rueckwaertsverweis von Schlagwort zu Monitor
        monitorDTO.schlagwoerter.forEach((s) => {
            const schlagwort: Schlagwort = {
                id: undefined,
                schlagwort: s,
                monitor,
            };
            monitor.schlagwoerter.push(schlagwort);
        });

        return monitor;
    }

    #handleCreateError(err: CreateError, res: Response) {
        switch (err.type) {
            case 'ConstraintViolations': {
                return this.#handleValidationError(err.messages, res);
            }

            case 'NameExists': {
                return this.#handleNameExists(err.name, res);
            }

            default: {
                return res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
    }

    #handleValidationError(
        messages: readonly string[],
        res: Response,
    ): Response {
        this.#logger.debug('#handleValidationError: messages=%o', messages);
        return res.status(HttpStatus.UNPROCESSABLE_ENTITY).send(messages);
    }

    #handleNameExists(
        name: string | null | undefined,
        res: Response,
    ): Response {
        const msg = `Der Name "${name}" existiert bereits.`;
        this.#logger.debug('#handleNameExists(): msg=%s', msg);
        return res
            .status(HttpStatus.UNPROCESSABLE_ENTITY)
            .set('Content-Type', 'text/plain')
            .send(msg);
    }

    #updateDtoToMonitor(monitorDTO: MonitorUpdateDTO): Monitor {
        const monitor: Monitor = {
            id: undefined,
            version: undefined,
            name: monitorDTO.name,
            hersteller: monitorDTO.hersteller,
            preis: monitorDTO.preis,
            bestand: monitorDTO.bestand,
            curved: monitorDTO.curved,
            refreshRate: monitorDTO.refreshRate,
            release: monitorDTO.release,
            schlagwoerter: [],
            erzeugt: undefined,
            aktualisiert: undefined,
        };

        return monitor;
    }

    #handleUpdateError(err: UpdateError, res: Response): Response {
        switch (err.type) {
            case 'ConstraintViolations': {
                return this.#handleValidationError(err.messages, res);
            }

            case 'MonitorNotExists': {
                const { id } = err;
                const msg = `Es gibt keinen Monitor mit der ID "${id}".`;
                this.#logger.debug('#handleUpdateError: msg=%s', msg);
                return res
                    .status(HttpStatus.PRECONDITION_FAILED)
                    .set('Content-Type', 'text/plain')
                    .send(msg);
            }

            case 'NameExists': {
                return this.#handleNameExists(err.name, res);
            }

            case 'VersionInvalid': {
                const { version } = err;
                const msg = `Die Versionsnummer "${version}" ist ungueltig.`;
                this.#logger.debug('#handleUpdateError: msg=%s', msg);
                return res
                    .status(HttpStatus.PRECONDITION_FAILED)
                    .set('Content-Type', 'text/plain')
                    .send(msg);
            }

            case 'VersionOutdated': {
                const { version } = err;
                const msg = `Die Versionsnummer "${version}" ist nicht aktuell.`;
                this.#logger.debug('#handleUpdateError: msg=%s', msg);
                return res
                    .status(HttpStatus.PRECONDITION_FAILED)
                    .set('Content-Type', 'text/plain')
                    .send(msg);
            }

            default: {
                return res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
            }
        }
    }
}
/* eslint-enable max-lines */
