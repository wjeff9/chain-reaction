import * as fs from 'fs';
import * as d3 from 'd3';

const csvString = fs.readFileSync('./data/olist_data.csv', 'utf8');
const data = d3.csvParse(csvString.slice(0, 1000));
console.log(data[0]);
