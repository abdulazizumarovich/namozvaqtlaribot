const axios = require("axios")
const cheerio = require('cheerio');

module.exports = {
  today: async function(region = 27) {
  let date_ob = new Date();
  let month = date_ob.getMonth() + 1;

  const resData = await axios.get(`https://islom.uz/vaqtlar/${region}/${month}`)
  const $ = cheerio.load(resData.data);
  const columns = $('tr.bugun').find('td');
  return {
    sana: $('div.date_time').text(),
    tong: $(columns[3]).text(),
    quyosh: $(columns[4]).text(),
    peshin: $(columns[5]).text(),
    asr: $(columns[6]).text(),
    shom: $(columns[7]).text(),
    xufton: $(columns[8]).text()
  }
}
}