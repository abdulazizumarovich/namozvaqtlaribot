const { Telegraf } = require('telegraf')
const schedule = require('node-schedule')
const express = require('express')
require('dotenv').config()

const data = require('./data.js')
const settings = require('./reminder_settings.json')

const bot = new Telegraf(process.env.BOT_TOKEN)
const chatID = process.env.CHAT_ID
const port = process.env.PORT || 5500
//on or off
const startupInfo = process.env.STARTUP_INFO || 'off'

/**
 * Just for heroku to continue web app's running state
 
const app = express()
app.use(express.json())

app.get('/', (req, res) => {
	res.status(200).json({ message: 'Kirgan kirdi telegram bot ishlayapti.'});
});
// TELEGRAM WEBHOOK - https://core.telegram.org/bots/api#setwebhook
app.post(`/${process.env.BOT_TOKEN}`, (req, res) => {
	bot.processUpdate(req.body);
	res.status(200).json({ message: 'ok' });
});

app.listen(port, () => {
	console.log(`Kirgan kirdi web serveri. port: ${port}`);
});
//heroku end
*/

let currentData = {}

function createReminderObjects(todayData) {
  const dateToday = new Date()
  dateToday.setSeconds(0)
  dateToday.setMilliseconds(0)
  return Object.entries(todayData)
    .filter(([key]) => key != 'sana')
    .map(([key, time]) => {
      const [hours, minutes] = time.split(':').map(Number)
      const date = new Date(dateToday)
      date.setHours(hours)
      date.setMinutes(minutes)
      return { key, date }
    })
}

function sendTimeAlerts(todayData) {
  if (!todayData || todayData.length === 0) {
    console.log('No data')
    bot.telegram.sendMessage(chatID, 'Ey, loglarga qara!')
    return
  }

  bot.telegram.sendMessage(chatID, 'Bot ishga tushdi')
  if (startupInfo == 'on')
    bot.telegram.sendMessage(chatID, prettyInfo())
	
  const now = new Date()
  todayData.forEach(({ date, key }) => {
    const alert = settings.alerts.find(alert => alert.key === key)
    const alertType = settings.alert_types.find(alert_type => alert_type.type == alert.alert_type)
    alertType.reminders_before.forEach(reminder => {
      const reminderDate = new Date(date.getTime() - reminder * 60 * 1000)
      if (reminderDate > now) {
        schedule.scheduleJob(reminderDate, () => {
          let reminderMessage = ''

          if (reminder == 0) {
            if (key == 'quyosh')
              reminderMessage = 'Quyosh chiqdiyov oynadan qarachi'
            else
              reminderMessage = `Kirgan kirdi. ${alert.name} vaqti bo'ldi`
          } else {
            reminderMessage = `${alert.name}ga ${reminder} daqiqa qoldi`
            if (key != 'quyosh')
              reminderMessage = '🍇 Uzumlar chayilganmi? ' + reminderMessage
          }

          bot.telegram.sendMessage(chatID, reminderMessage)
        })
      }
    })
  })
}

function prettyInfo() {
  if (!currentData) return 'Nimadir xatomi diymanda'
  return currentData.sana.split('|')[1].trim() + '\n' +
    currentData.sana.split('|')[0].trim() + '\n\n' +
    Object.entries(currentData)
      .filter(([key]) => key != 'sana')
      .map(([key, time]) => {
        const alert = settings.alerts.find(alert => alert.key == key)
        return `${alert.name}: ${time} (${alert.alert_type})`
      }).join('\n')
}

async function start() {
  try {
    console.log('Setting scheduler for today\'s reminders')
    currentData = await data.today()
    const timeDates = createReminderObjects(currentData)
    sendTimeAlerts(timeDates)
    console.log('Scheduler is set')
  } catch (e) {
    console.log(e)
    bot.telegram.sendMessage(chatID, 'Ey, loglarga qara!')
  }
}

let job = schedule.scheduleJob(settings.scheduler_expresion, () => start())
console.log('Next schedule time: ' + job.nextInvocation().toString())

bot.start((ctx) => {
  ctx.reply(prettyInfo())
})

bot.launch()

start()
