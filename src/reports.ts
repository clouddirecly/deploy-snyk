/**
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

import {Transform, TransformCallback} from 'stream';

import {Table, TableSchema} from '@google-cloud/bigquery';

import {buildSchema, compareSchema, getNames, removeDays, transformSchema,updateSchema} from './bq';
import {info, sleep, warn} from './helpers';
import {ArgonOpts, GoogleAuthClient} from './typings';


// March 2021
// API renamed fields to match updated product branding
// https://support.google.com/displayvideo/answer/10359125
const NAME_PATTERNS = new Map<RegExp, string>([
  // dcm or cm, not followed by 360 -> cm360
  [/d?cm(?!360)/, 'cm360'],

  // dbm -> dv360
  [/dbm/, 'dv360'],
]);

export abstract class ReportFetcherBase {
  constructor(
    protected client: GoogleAuthClient,
    protected reportId: number,
    protected profileId: number | null
  ) {}
  abstract getReportName(): Promise<string>;
  abstract getReports(): Promise<Map<number, string>>;
}

export class CSVExtractorBase extends Transform {
  protected fileIdColumn: string;
  public counter = 0;

  constructor(
    protected table: Table,
    public tableSchema: TableSchema,
    fileId: number,
    public reports:Map<number, string>,
    public tableExists : boolean,
    public opts: ArgonOpts,
    public pendingIds:number[],
    public tableName:string,
    public bq:any
  ) {
    super();
    this.fileIdColumn = `,${fileId}`;
  }

  pushLine(chunk: string): void {
    // Start with actual csv line
    this.push(chunk);
    // End with file ID
    this.push(this.fileIdColumn);
    // Start next line
    this.push('\n');

    // Increment rows counter
    ++this.counter;
  }

  _flush(done: TransformCallback): void {
    
    if (this.counter === 0) {
      this.emit('error', Error('No CSV lines found.'));
    }else{
      if (this.reports && this.tableExists && this.opts.single) {
        if (this.opts.days !== null && this.pendingIds.length > 0) {
          info('remove job');
          const path = `${this.opts.projectId}.${this.opts.datasetName}.${this.tableName}`;
          this.jobRemove(this.opts.days, path, this.bq).then(() => {
            console.log(`Elimine la data de los ${this.opts.days} dias`); 
            return done();
          });
        }else{
          return done();
        }
      }else{
        return done();
      }
    }
  }

  async handleFields(names: string[]): Promise<void> {
    info('Generating report schema.');
    const reportSchema = buildSchema(names);

    if (!this.tableSchema) {
      // Initial ingestion: Create new table with report schema
      return this.createTable(reportSchema);
    } else {
      // Subsequent ingestions: Ensure table and report schemas match
      const path = `${this.opts.projectId}.${this.opts.datasetName}.${this.tableName}`;
      return await this.checkSchema(reportSchema, path, this.bq);
    }
  }

  async jobRemove(days: number | null, path: string, bq: any) {
    const query = removeDays(days, path);
    await bq.query(query);
    return true;
  }

  async createTable(schema: TableSchema): Promise<void> {
    info('Creating BigQuery Table.');
    const [, metadata] = await this.table.create({schema});
    this.tableSchema = metadata.schema;
  }

  async checkSchema(schema: TableSchema, path: string, bq: any): Promise<void>{
    info('Checking schemas for consistency.');
    let schemaMatches = compareSchema(this.tableSchema, schema);

    if (schemaMatches) {
      return;
    }

    const names_columns = getNames(schema);
    await this.updateSchemaTable(names_columns, path, bq)
  
    
    const dataset = bq.dataset(this.opts.datasetName)
    const table = dataset.table(this.tableName);
    const [metadata] = await table.getMetadata();
    this.tableSchema = metadata.schema;

    schemaMatches = compareSchema(this.tableSchema, schema);

    // warn('Schema comparison failed. Attempting to rename old columns.');
    // const renamedSchema = transformSchema(this.tableSchema, NAME_PATTERNS);
    
    // if (renamedSchema) {
    //   warn('Legacy columns detected in table schema.');
    //   info(`Renamed fields: ${getNames(renamedSchema)}`);
    //   schemaMatches = compareSchema(renamedSchema, schema);
    // } else {
    //   warn('No columns can be renamed.');
    // }

    if (!schemaMatches) {
      this.emit('error', Error('Schema does not match.'));
    }
  }


  async updateSchemaTable(schema: string[], path: string, bq: any) {
    const query = updateSchema(schema,path);
    await bq.query(query);
    console.log(`Actualice la tabla ${path}`);
    return true;
  }
}
