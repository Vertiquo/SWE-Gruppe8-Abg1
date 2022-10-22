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
import { AuthModule } from '../security/auth/auth.module.js';
import { MailModule } from '../mail/mail.module.js';
import { Module } from '@nestjs/common';
import { Monitor } from './entity/monitor.entity.js';
import { MonitorGetController } from './rest/Monitor-get.controller.js';
import { MonitorMutationResolver } from './graphql/Monitor-mutation.resolver.js';
import { MonitorQueryResolver } from './graphql/Monitor-query.resolver.js';
import { MonitorReadService } from './service/Monitor-read.service.js';
import { MonitorValidationService } from './service/Monitor-validation.service.js';
import { MonitorWriteController } from './rest/Monitor-write.controller.js';
import { MonitorWriteService } from './service/Monitor-write.service.js';
import { QueryBuilder } from './service/query-builder.js';
import { Schlagwort } from './entity/schlagwort.entity.js';
import { TypeOrmModule } from '@nestjs/typeorm';

/**
 * Das Modul besteht aus Controller- und Service-Klassen für die Verwaltung von
 * Monitore.
 * @packageDocumentation
 */

/**
 * Die dekorierte Modul-Klasse mit Controller- und Service-Klassen sowie der
 * Funktionalität für TypeORM.
 */
@Module({
    imports: [
        MailModule,
        // siehe auch src\app.module.ts
        TypeOrmModule.forFeature([Monitor, Schlagwort]),
        AuthModule,
    ],
    controllers: [MonitorGetController, MonitorWriteController],
    // Provider sind z.B. Service-Klassen fuer DI
    providers: [
        MonitorReadService,
        MonitorWriteService,
        MonitorValidationService,
        MonitorQueryResolver,
        MonitorMutationResolver,
        QueryBuilder,
    ],
    // Export der Provider fuer DI in anderen Modulen
    exports: [
        MonitorReadService,
        MonitorWriteService,
        MonitorValidationService,
    ],
})
export class MonitorModule {}
