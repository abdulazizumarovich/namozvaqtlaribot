const axios = require("axios")
const cheerio = require('cheerio');

module.exports = {
  islom: async function(region) {
  let date_ob = new Date();
  let month = date_ob.getMonth() + 1;

  const resData = await axios.get(`https://islom.uz/vaqtlar/${region}/${month}`)
  const $ = cheerio.load(resData.data);
  const columns = $('tr.bugun').find('td');
  return {
    manba: "islom.uz",
    sana: $('div.date_time').text(),
    juma: date_ob.getDay() == 5,
    tong: $(columns[3]).text(),
    quyosh: $(columns[4]).text(),
    peshin: $(columns[5]).text(),
    asr: $(columns[6]).text(),
    shom: $(columns[7]).text(),
    xufton: $(columns[8]).text()
  }
},
aladhan: async function(latitude, longitude, method) {
  let date_ob = new Date();
  const apiUrl = `https://api.aladhan.com/v1/timings?latitude=${latitude}&longitude=${longitude}&method=${method}&school=1`

  try {
    const response = await axios.get(apiUrl)

    if (response.status === 200) {
      const data = response.data.data
      const timings = data.timings
      return {
        manba: "aladhan.com",
        sana: data.date.readable + ' | ' + data.date.hijri.date,
        juma: date_ob.getDay() == 5,
        tong: timings.Fajr,
        quyosh: timings.Sunrise,
        peshin: timings.Dhuhr,
        asr: timings.Asr,
        shom: timings.Maghrib,
        xufton: timings.Isha
      }
    } else {
      console.error('Error fetching prayer timings:', response.statusText)
      return null;
    }
  } catch (error) {
    console.error('Error:', error.message)
    return null
  }
}
}