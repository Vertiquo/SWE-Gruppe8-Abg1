/*
 * Copyright (C) 2019 - present Juergen Zimmermann, Hochschule Karlsruhe
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
import { type GenericJsonSchema } from './GenericJsonSchema.js';

export const MAX_RATING = 5;

export const jsonSchema: GenericJsonSchema = {
    // naechstes Release: 2021-02-01
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://acme.com/monitor.json#',
    title: 'Monitor',
    description: 'Eigenschaften eines Monitores: Typen und Constraints',
    type: 'object',
    properties: {
        id: {
            type: 'string',
            pattern:
                '^[\\dA-Fa-f]{8}-[\\dA-Fa-f]{4}-[\\dA-Fa-f]{4}-[\\dA-Fa-f]{4}-[\\dA-Fa-f]{12}$',
        },
        version: {
            type: 'number',
            minimum: 0,
        },
        name: {
            type: 'string',
            pattern: '^\\w.*',
        },
        hersteller: {
            type: 'string',
            pattern: '^\\w.*',
        },
        preis: {
            type: 'number',
            minimum: 0,
        },
        bestand: {
            type: 'number',
            minimum: 0,
        },
        curved: {
            type: 'boolean',
        },
        refreshrate: {
            type: 'string',
            enum: ['Hz60', 'Hz120', 'Hz144', 'Hz240'],
        },
        release: { type: 'string', format: 'date' },
        schlagwoerter: {
            type: 'array',
            items: { type: 'object' },
        },
        erzeugt: { type: ['string', 'null'] },
        aktualisiert: { type: ['string', 'null'] },
    },
    required: ['name', 'hersteller', 'preis'],
    additionalProperties: false,
    errorMessage: {
        properties: {
            version: 'Die Versionsnummer muss mindestens 0 sein.',
            name: 'Der Monitorname muss mit einem Buchstaben, einer Ziffer oder _ beginnen.',
            hersteller:
                'Der Herstellername muss mit einem Buchstaben, einer Ziffer oder _ beginnen.',
            preis: 'Der Preis darf nicht negativ sein.',
            bestand: 'Der Bestand darf nicht negativ sein.',
            curved: "Das Attribut 'curved' muss ein boolean Wert (true/false) sein.",
            refreshrate:
                'Die Bildwiederholungsfrequenz muss einer der folgenden Werte sein: (Hz60 | Hz120 | Hz144 | Hz240).',
            release: 'Das Releasedatum muss im Format yyyy-MM-dd sein.',
        },
    },
};
