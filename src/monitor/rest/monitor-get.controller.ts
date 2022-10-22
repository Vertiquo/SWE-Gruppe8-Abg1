// eslint-disable-next-line eslint-comments/disable-enable-pair
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
 * Das Modul besteht aus der Controller-Klasse für Lesen an der REST-Schnittstelle.
 * @packageDocumentation
 */

// eslint-disable-next-line max-classes-per-file
import {
    ApiHeader,
    ApiNotFoundResponse,
    ApiOkResponse,
    ApiOperation,
    ApiParam,
    ApiProperty,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';
import {
    Controller,
    Get,
    Headers,
    HttpStatus,
    Param,
    Query,
    Req,
    Res,
    UseInterceptors,
} from '@nestjs/common';
import {
    MonitorReadService,
    type Suchkriterien,
} from '../service/monitor-read.service.js';
import { type Monitor } from '../entity/monitor.entity.js';
import { Request, Response } from 'express';
import { ResponseTimeInterceptor } from '../../logger/response-time.interceptor.js';
import { getBaseUri } from './getBaseUri.js';
import { getLogger } from '../../logger/logger.js';
import { httpsAgent } from '../../../__tests__/testserver.js';

interface Link {
    href: string;
}
interface Links {
    self: Link;
    //optional
    list?: Link;
    add?: Link;
    update?: Link;
    remove?: Link;
}

// Interface für GET-Request mit Links für HATEOAS
export type MonitorModel = Omit<
    Monitor,
    'aktualisiert' | 'erzeugt' | 'id' | 'schlagwoerter' | 'version'
> & {
    schlagwoerter: string[];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _links: Links;
};

export interface MonitoreModel {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    _embedded: {
        monitore: MonitorModel[];
    };
}

/**
 * Klasse für `MonitorGetController`, um Queries in _OpenAPI_ bzw. Swagger zu
 * formulieren. `MonitorController` hat dieselben Properties wie die Basisklasse
 * `Monitor` - allerdings mit dem Unterschied, dass diese Properties beim Ableiten
 * so überschrieben sind, dass sie auch nicht gesetzt bzw. undefined sein
 * dürfen, damit die Queries flexibel formuliert werden können. Deshalb ist auch
 * immer der zusätzliche Typ undefined erforderlich.
 * Außerdem muss noch `string` statt `Date` verwendet werden, weil es in OpenAPI
 * den Typ Date nicht gibt.
 */
export class MonitorQuery implements Suchkriterien {
    @ApiProperty({ required: false })
    declare readonly name: string;

    @ApiProperty({ required: false })
    declare readonly hersteller: string;

    @ApiProperty({ required: false })
    declare readonly preis: number;

    @ApiProperty({ required: false })
    declare readonly bestand: number;

    @ApiProperty({ required: false })
    declare readonly curved: boolean;

    @ApiProperty({ required: false })
    declare readonly highres: boolean;

    @ApiProperty({ required: false })
    declare readonly slim: boolean;
}

/**
 * Die Controller-Klasse für die Verwaltung von Monitoren.
 */
// Decorator in TypeSc// Decorator in TypeScript, zur Standardisierung in ES vorgeschlagen (stage 3)
// https://github.com/tc39/proposal-decorators
@Controller()
@UseInterceptors(ResponseTimeInterceptor)
@ApiTags('Monitor API')
export class MonitorGetController {
    readonly #service: MonitorReadService;

    readonly #logger = getLogger(MonitorGetController.name);

    constructor(service: MonitorReadService) {
        this.#service = service;
    }

    /**
     * Ein Monitor wird asynchron anhand seiner ID als Pfadparameter gesucht.
     *
     * Falls es ein solches Monitor gibt und `If-None-Match` im Request-Header
     * auf die aktuelle Version des Monitores gesetzt war, wird der Statuscode
     * `304` (`Not Modified`) zurückgeliefert. Falls `If-None-Match` nicht
     * gesetzt ist oder eine veraltete Version enthält, wird das gefundene
     * Monitor im Rumpf des Response als JSON-Datensatz mit Atom-Links für HATEOAS
     * und dem Statuscode `200` (`OK`) zurückgeliefert.
     *
     * Falls es kein Monitor zur angegebenen ID gibt, wird der Statuscode `404`
     * (`Not Found`) zurückgeliefert.
     *
     * @param id Pfad-Parameter `id`
     * @param req Request-Objekt von Express mit Pfadparameter, Query-String,
     *            Request-Header und Request-Body.
     * @param version Versionsnummer im Request-Header bei `If-None-Match`
     * @param accept Content-Type bzw. MIME-Type
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    // vgl Kotlin: Schluesselwort "suspend"
    // eslint-disable-next-line max-params, max-lines-per-function
    @Get(':id')
    @ApiOperation({ summary: 'Suche mit der Monitor-ID', tags: ['Suchen'] })
    @ApiParam({
        name: 'id',
        description: 'Z.B. 00000000-0000-0000-0000-000000000001',
    })
    @ApiHeader({
        name: 'If-None-Match',
        description: 'Header für bedingte GET-Requests, z.B. "0"',
        required: false,
    })
    @ApiOkResponse({ description: 'Der Monitor wurde nicht gefunden' })
    @ApiNotFoundResponse({
        description: 'Kein Monitor zur gegebenen ID gefunden',
    })
    @ApiResponse({
        status: HttpStatus.NOT_MODIFIED,
        description:
            'Die Daten für diesen Monitor wurden bereits heruntergeladen.',
    })
    async findById(
        @Param('id') id: string,
        @Req() req: Request,
        @Headers('If-None-Match') version: string | undefined,
        @Res() res: Response,
    ): Promise<Response<MonitorModel | undefined>> {
        this.#logger.debug('findById: id=%s, version=%s', id, version);

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('findById: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        let monitor: Monitor | undefined;
        try {
            monitor = await this.#service.findById(id);
        } catch (err) {
            // err ist implizit vom Typ "unknown", d.h. keine Operationen koennen ausgefuehrt werden
            // Exception einer export async function bei der Ausfuehrung fangen:
            // https://strongloop.com/strongblog/comparing-node-js-promises-trycatch-zone-js-angular
            this.#logger.error('findById: error=%o', err);
            return res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        }

        if (monitor === undefined) {
            this.#logger.debug('findById: NOT_FOUND');
            return res.sendStatus(HttpStatus.NOT_FOUND);
        }
        this.#logger.debug('findById(): monitor=%o', monitor);

        // ETags
        const versionDb = monitor.version;
        if (version === `"${versionDb}"`) {
            this.#logger.debug('findById: NOT_MODIFIED');
            return res.sendStatus(HttpStatus.NOT_MODIFIED);
        }
        this.#logger.debug('findById: versionDb=%s', versionDb);
        res.header('ETag', `"${versionDb}"`);

        // HATEOAS mit Atom Links und HAL (= Hypertext Application Language)
        const monitorModel = this.#toModel(monitor, req);
        this.#logger.debug('findById: monitorModel=%o', monitorModel);
        return res.json(monitorModel);
    }

    /**
     * Monitoren werden mit Query-Parametern asynchron gesucht. Falls es mindestens
     * einen solchen Monitor gibt, wird der Statuscode `200` (`OK`) gesetzt. Im Rumpf
     * des Response ist das JSON-Array mit den gefundenen Monitoren, die jeweils
     * um Atom-Links für HATEOAS ergänzt sind.
     *
     * Falls es kein Monitor zu den Suchkriterien gibt, wird der Statuscode `404`
     * (`Not Found`) gesetzt.
     *
     * Falls es keine Query-Parameter gibt, werden alle Monitore ermittelt.
     *
     * @param query Query-Parameter von Express.
     * @param req Request-Objekt von Express.
     * @param res Leeres Response-Objekt von Express.
     * @returns Leeres Promise-Objekt.
     */
    @Get()
    @ApiOperation({ summary: 'Suche mit Suchkriterien', tags: ['Suchen'] })
    @ApiOkResponse({ description: 'Eine evtl. leere Liste mit Monitoren' })
    async find(
        @Query() query: MonitorQuery,
        @Req() req: Request,
        @Res() res: Response,
    ): Promise<Response<MonitoreModel | undefined>> {
        this.#logger.debug('find: query=%o', query);

        if (req.accepts(['json', 'html']) === false) {
            this.#logger.debug('find: accepted=%o', req.accepted);
            return res.sendStatus(HttpStatus.NOT_ACCEPTABLE);
        }

        const monitore = await this.#service.find(query);
        this.#logger.debug('find: %o', monitore);
        if (monitore.length === 0) {
            this.#logger.debug('find: NOT_FOUND');
            return res.sendStatus(HttpStatus.NOT_FOUND);
        }

        // HATEOAS: Atom Links je Monitor
        const monitoreModel = monitore.map((monitor) =>
            this.#toModel(monitor, req, false),
        );
        this.#logger.debug('find: monitoreModel=%o', monitoreModel);

        const result: MonitoreModel = { _embedded: { monitore: monitoreModel } };
        return res.json(result).send();
    }

    #toModel(monitor: Monitor, req: Request, all = true) {
        const baseUri = getBaseUri(req);
        this.#logger.debug('#toModel: baseUri=%s', baseUri);
        const { id } = monitor;
        const schlagwoerter = monitor.schlagwoerter.map(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            (schlagwort) => schlagwort.schlagwort!,
        );
        const links = all
            ? {
                  self: { href: `${baseUri}/${id}` },
                  list: { href: `${baseUri}` },
                  add: { href: `${baseUri}` },
                  update: { href: `${baseUri}/${id}` },
                  remove: { href: `${baseUri}/${id}` },
              }
            : { self: { href: `${baseUri}/${id}` } };

        this.#logger.debug('#toModel: monitor=%o, links=%o', monitor, links);
        /* eslint-disable unicorn/consistent-destructuring */
        const monitorModel: MonitorModel = {
            name: monitor.name,
            hersteller: monitor.hersteller,
            preis: monitor.preis,
            bestand: monitor.bestand,
            curved: monitor.curved,
            release: monitor.release,
            schlagwoerter,
            _links: links,
        };
        /* eslint-enable unicorn/consistent-destructuring */

        return monitorModel;
    }
}
