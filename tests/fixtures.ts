// Synthetic statement lines shaped like the real pdf.js output. Names/numbers are made up.
import type { Line } from '../src/parse/types';

export const L = (page: number, y: number, ...cells: Array<[number, string]>): Line => ({ page, y, cells: cells.map(([x, s]) => ({ x, s })) });

export const maybankSavingsLines: Line[] = [
  L(1, 761, [214, 'Maybank Islamic Berhad (787435-M)']),
  L(1, 716, [371, ':'], [448, '31/10/26']),
  L(1, 711, [76, 'ALI BIN ABU']),
  L(1, 706, [321, 'STATEMENT DATE']),
  L(1, 684, [371, ':'], [422, '112233-001234']),
  L(1, 646, [25, 'PROTECTED BY PIDM UP TO RM250,000 FOR EACH DEPOSITOR'], [416, 'PERSONAL SAVER-i']),
  L(1, 632, [140, 'URUSNIAGA AKAUN/'], [280, '/ACCOUNT TRANSACTIONS']),
  L(1, 600, [36, 'ENTRY DATE'], [160, 'TRANSACTION DESCRIPTION'], [325, 'TRANSACTION AMOUNT'], [415, 'STATEMENT BALANCE']),
  L(1, 588, [87.7, 'BEGINNING BALANCE'], [445, '1,000.00']),
  L(1, 576, [43, '01/10/26'], [87.7, 'FPX PAYMENT FR A/'], [365, '100.00-'], [445, '900.00']),
  L(1, 564, [95.2, 'ABC123DEF456 *']),
  L(1, 552, [95.2, 'SYARIKAT AIR CONTOH']),
  L(1, 540, [43, '01/10/26'], [87.7, 'PYMT FROM A/C'], [365, '250.00-'], [445, '650.00']),
  L(1, 88, [25, 'Perhation / Note']),
  // page 2: header block, then the previous row's continuation lines
  L(2, 761, [214, 'Maybank Islamic Berhad (787435-M)']),
  L(2, 711, [76, 'ALI BIN ABU']),
  L(2, 600, [36, 'ENTRY DATE'], [160, 'TRANSACTION DESCRIPTION']),
  L(2, 588, [95.2, 'VISA ISLAMIC *']),
  L(2, 576, [95.2, 'XXXX-XXXX-XXXX-9999']),
  L(2, 564, [43, '23/10/26'], [87.7, 'SVG GIRO CR'], [358, '5,000.00+'], [445, '5,650.00']),
  L(2, 552, [95.2, 'SYARIKAT GAJI SDN']),
  L(2, 324, [87.7, 'ENDING BALANCE :'], [357, '5,650.00']),
  L(2, 312, [87.7, 'TOTAL CREDIT :'], [357, '5,000.00']),
];

export const maybankCardLines: Line[] = [
  L(1, 853, [181, 'STATEMENT OF CREDIT CARD ACCOUNT']),
  L(1, 829, [475, 'Maybank Islamic Berhad (787435-M)']),
  L(1, 700, [400, '28 JAN 27'], [480, '17 FEB 27']),
  L(1, 410, [26, 'Posting Date /'], [89, 'Transaction Date /'], [288, 'Transaction Description /'], [521, 'Amount(RM) /']),
  L(1, 356, [166, 'VISA IKHWAN GOLD'], [254, ':'], [268, '4000 1111 2222 9999']),
  L(1, 288, [166, 'YOUR PREVIOUS STATEMENT BALANCE'], [546, '250.00']),
  L(1, 254, [42, '29/12'], [113, '29/12'], [166, 'RTL PROFIT CHRG RATE 15.00%']),
  L(1, 241, [42, '30/12'], [113, '28/12'], [166, 'Foodpanda Malaysia'], [404, 'KualaLumpur'], [464, 'MY'], [551, '57.24']),
  L(1, 228, [42, '02/01'], [113, '02/01'], [166, 'PYMT@MAYBANK2U.COM'], [546, '250.00CR']),
  L(1, 215, [42, '05/01'], [113, '04/01'], [166, 'CASH BACK'], [551, '5.00CR']),
  L(2, 758, [420, 'SUB TOTAL/JUMLAH'], [538, '52.24']),
  L(5, 768, [25, 'Maybank Card TreatsPoints earned for the month'], [564, '3,099']),
];

export const ambankCardLines: Line[] = [
  L(1, 749, [64, 'TSLF'], [87, '1 of 3']),
  L(1, 626, [327, 'Statement Date /'], [392, 'Tarikh Penyata'], [521, '28 OCT 26']),
  L(2, 814, [324, 'CREDIT CARD STATEMENT / INVOICE']),
  L(2, 510, [64, 'YOUR TRANSACTION DETAILS /'], [236, 'TRANSAKSI TERPERINCI ANDA']),
  L(2, 476, [221.3, 'AmBank Islamic VISA Infinite (P) 4000 0000 0000 1111']),
  L(2, 465, [221.3, 'PREVIOUS BALANCE'], [516, '1,000.00']),
  L(2, 453, [84, '01 OCT 26'], [158, '01 OCT 26'], [221.3, 'PAYMENT VIA RPP RECEIVED - THANK YOU,ALI BIN'], [516, '1,000.00 CR']),
  L(2, 444, [221.3, 'ABU,sept26,']),
  L(2, 422, [84, '20 OCT 26'], [158, '22 OCT 26'], [221.3, 'PRUBSN-RPS 1234567890'], [326, 'KUALA LUMPUR MY'], [522, '198.00']),
  L(2, 400, [221.3, 'SUB TOTAL - 4000000000001111'], [522, '198.00']),
  L(2, 371, [221.3, 'AmBank Islamic VISA Infinite (S) 4000 0000 0000 2222']),
  L(2, 360, [221.3, 'PREVIOUS BALANCE'], [522, '0.00']),
  L(2, 349, [84, '29 SEP 26'], [158, '01 OCT 26'], [221.3, 'AEON CO-SHAH ALAM'], [324, 'SHAH ALAM'], [380, 'MY'], [527, '31.80']),
  L(2, 245, [221.3, 'Please see overleaf for more transaction details.']),
  L(3, 686, [84, '20 OCT 26'], [158, '22 OCT 26'], [221.3, 'GIANT HYPER SHAH ALAM'], [396, 'MY'], [527, '62.05']),
  L(3, 675, [221.3, 'SUB TOTAL - 4000000000002222'], [522, '93.85']),
  L(3, 596, [221.3, 'Total Current Balance'], [516, '291.85']),
  L(3, 500, [84, '01 JAN 27'], [158, '01 JAN 27'], [221.3, 'REWARDS TABLE ROW'], [527, '9.99']),
];
