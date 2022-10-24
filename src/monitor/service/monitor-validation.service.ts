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

// https://json-schema.org/implementations.html

/**
 * Das Modul besteht aus der Klasse {@linkcode MonitorValidationService}.
 * @packageDocumentation
 */

// Ajv wird auch von Fastify genutzt
// Ajv hat ca 75 Mio Downloads/Woche, classvalidator (Nest, aehnlich Hibernate Validator) nur 1,5 Mio
// https://ajv.js.org/guide/schema-language.html#draft-2019-09-and-draft-2012-12
// https://github.com/ajv-validator/ajv/blob/master/docs/validation.md
import Ajv2020 from 'ajv/dist/2020.js';
import { type FormatValidator } from 'ajv/dist/types/index.js';
import { Injectable } from '@nestjs/common';
import { type Monitor } from '../entity/monitor.entity.js';
import RE2 from 're2';
import ajvErrors from 'ajv-errors';
import formatsPlugin from 'ajv-formats';
import { getLogger } from '../../logger/logger.js';
import { jsonSchema } from './jsonSchema.js';

export const ID_PATTERN = new RE2(
    '^[\\dA-Fa-f]{8}-[\\dA-Fa-f]{4}-[\\dA-Fa-f]{4}-[\\dA-Fa-f]{4}-[\\dA-Fa-f]{12}$',
);
@Injectable()
export class MonitorValidationService {
    #ajv = new Ajv2020({
        allowUnionTypes: true,
        allErrors: true,
    });

    readonly #logger = getLogger(MonitorValidationService.name);

    constructor() {
        // https://github.com/ajv-validator/ajv-formats#formats
        formatsPlugin(this.#ajv, ['date', 'email', 'uri']);
        ajvErrors(this.#ajv);
    }

    validateId(id: string) {
        return ID_PATTERN.test(id);
    }

    #checkChars(chars: string[]) {
        /* eslint-disable @typescript-eslint/no-magic-numbers, unicorn/no-for-loop, security/detect-object-injection */
        let sum = 0;
        let check: number | string;

        if (chars.length === 9) {
            // Compute the ISBN-10 check digit
            chars.reverse();
            for (let i = 0; i < chars.length; i++) {
                sum += (i + 2) * Number.parseInt(chars[i] ?? '', 10);
            }
            check = 11 - (sum % 11); // eslint-disable-line @typescript-eslint/no-extra-parens
            if (check === 10) {
                check = 'X';
            } else if (check === 11) {
                check = '0';
            }
        } else {
            // Compute the ISBN-13 check digit
            for (let i = 0; i < chars.length; i++) {
                sum += ((i % 2) * 2 + 1) * Number.parseInt(chars[i] ?? '', 10); // eslint-disable-line @typescript-eslint/no-extra-parens
            }
            check = 10 - (sum % 10); // eslint-disable-line @typescript-eslint/no-extra-parens
            if (check === 10) {
                check = '0';
            }
        }
        return check;
        /* eslint-enable @typescript-eslint/no-magic-numbers, unicorn/no-for-loop, security/detect-object-injection */
    }

    /**
     * Funktion zur Validierung, wenn neue Bücher angelegt oder vorhandene Bücher
     * aktualisiert bzw. überschrieben werden sollen.
     */
    validate(monitor: Monitor) {
        this.#logger.debug('validate: monitor=%o', monitor);
        const validate = this.#ajv.compile<Monitor>(jsonSchema);
        validate(monitor);

        // nullish coalescing
        const errors = validate.errors ?? [];
        const messages = errors
            .map((error) => error.message)
            .filter((msg) => msg !== undefined);
        this.#logger.debug(
            'validate: errors=%o, messages=%o',
            errors,
            messages,
        );
        return messages.length > 0 ? (messages as string[]) : undefined;
    }
}
