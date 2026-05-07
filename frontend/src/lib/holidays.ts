export const WORLD_HOLIDAYS: Record<string, string> = {
  '01-21': 'Międzynarodowy Dzień Przytulania',
  '02-09': 'Dzień Pizzy',
  '03-14': 'Dzień Liczby Pi',
  '04-02': 'Międzynarodowy Dzień Książki dla Dzieci',
  '05-04': 'Dzień Gwiezdnych Wojen',
  '05-05': 'Międzynarodowy Dzień Czekolady',
  '05-06': 'Dzień bez Diety',
  '05-07': 'Międzynarodowy Dzień Astronomii',
  '05-15': 'Międzynarodowy Dzień Rodziny',
  '06-21': 'Międzynarodowy Dzień Jogi',
  '07-17': 'Światowy Dzień Emoji',
  '08-08': 'Międzynarodowy Dzień Kota',
  '09-19': 'Międzynarodowy Dzień Mówienia jak Pirat',
  '10-01': 'Międzynarodowy Dzień Kawy',
  '11-13': 'Światowy Dzień Życzliwości',
  '12-21': 'Światowy Dzień Pomarańczy',
};

export function getTodayHoliday(date: Date): string | null {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return WORLD_HOLIDAYS[`${m}-${d}`] ?? null;
}
