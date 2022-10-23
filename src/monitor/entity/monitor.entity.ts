/*
 * Copyright (C) 2016 - present Juergen Zimmermann, Florian Goebel, Hochschule Karlsruhe
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

// Nest unterstützt verschiedene Werkzeuge fuer OR-Mapping
// https://docs.nestjs.com/techniques/database
//  * TypeORM     https://typeorm.io
//  * Sequelize   https://sequelize.org
//  * Knex        https://knexjs.org

// TypeORM unterstützt die Patterns
//  * "Data Mapper" und orientiert sich an Hibernate (Java), Doctrine (PHP) und Entity Framework (C#)
//  * "Active Record" und orientiert sich an Mongoose (JavaScript)

// TypeORM unterstützt u.a. die DB-Systeme
//  * Postgres
//  * MySQL
//  * Oracle
//  * Microsoft SQL Server
//  * SAP Hana
//  * Cloud Spanner von Google

/**
 * Das Modul besteht aus der Entity-Klasse.
 * @packageDocumentation
 */

import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryColumn,
    UpdateDateColumn,
    VersionColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { DecimalTransformer } from './decimal-transformer.js';
import { Schlagwort } from './schlagwort.entity.js';

export type RefreshRate = '60' | '120' | '144' | '240';

@Entity()
export class Monitor {
    @Column('char')
    @PrimaryColumn('uuid')
    id: string | undefined;

    @VersionColumn()
    readonly version: number | undefined;

    @Column('varchar')
    @ApiProperty({ example: 'Max Resolutor', type: String })
    readonly name!: string;

    @Column('varchar')
    @ApiProperty({ example: 'Kleinemann', type: String })
    readonly hersteller!: string;

    @Column({ type: 'decimal', transformer: new DecimalTransformer() })
    @ApiProperty({ example: '1999.99', type: Number })
    readonly preis!: number;

    @Column('number')
    @ApiProperty({ example: '40', type: String })
    readonly bestand!: number;

    @Column('boolean')
    @ApiProperty({ example: true, type: Boolean })
    readonly curved: boolean | undefined;

    @Column('string')
    @ApiProperty({ example: 60, type: String })
    readonly refreshRate!: RefreshRate;

    @Column('date')
    @ApiProperty({ example: '2022-22-10' })
    readonly release: Date | string | undefined;

    @OneToMany(() => Schlagwort, (schlagwort) => schlagwort.monitor, {
        eager: true,
        cascade: ['insert'],
    })
    @ApiProperty({ example: ['highres', 'slim'] })
    readonly schlagwoerter!: Schlagwort[];

    @CreateDateColumn({ type: 'timestamp' })
    readonly erzeugt: Date | undefined = new Date();

    @UpdateDateColumn({ type: 'timestamp' })
    readonly aktualisiert: Date | undefined = new Date();
}
