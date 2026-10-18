import { MikroORM } from '@mikro-orm/sqlite';
import config from './../../../mikro-orm.config.js';

// @ts-ignore
const orm = await MikroORM.init(config);

export default orm;