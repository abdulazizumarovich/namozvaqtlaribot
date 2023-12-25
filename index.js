const { Telegraf } = require('telegraf')
const schedule = require('node-schedule')
const parser = require('cron-parser')

require('dotenv').config()

const data = require('./data.js')
const settings = require('./reminder_settings.json')

const bot = new Telegraf(process.env.BOT_TOKEN)
const chatID = process.env.CHAT_ID
//on or off
const startupInfo = process.env.STARTUP_INFO || 'off'

let currentData

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

function sendTimeAlerts(todayData, startupCall) {
  if (!todayData || todayData.length === 0) {
    console.log('No data')
    bot.telegram.sendMessage(chatID, 'Ey, loglarga qara!')
    return
  }

  if (startupCall) {
    if (startupInfo == 'on') bot.telegram.sendMessage(chatID, 'Bot ishga tushdi')
  } else bot.telegram.sendMessage(chatID, `Ma'lumotlar yangilandi:\n\n ${prettyInfo()}`)

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

async function prettyInfo() {
  if (!currentData) {
    currentData = await data.today()
  }
  return currentData.sana.split('|')[1].trim() + '\n' +
    currentData.sana.split('|')[0].trim() + '\n\n' +
    Object.entries(currentData)
      .filter(([key]) => key != 'sana')
      .map(([key, time]) => {
        const alert = settings.alerts.find(alert => alert.key == key)
        return `${alert.name}: ${time} (${alert.alert_type})`
      }).join('\n') + '\n\n© islom.uz'
}

async function start(startupCall = false) {
  try {
    console.log('Setting scheduler for today\'s reminders')
    currentData = await data.today()
    const timeDates = createReminderObjects(currentData)
    sendTimeAlerts(timeDates, startupCall)
    console.log('Scheduler is set')
  } catch (e) {
    console.log(e)
    bot.telegram.sendMessage(chatID, 'Ey, loglarga qara!')
  }
}

const job = schedule.scheduleJob(settings.scheduler_expresion, () => start())

function checkStartupSet() {
  const today = new Date().getDay()
  const expectedDays = parser.parseExpression(settings.scheduler_expresion).fields.dayOfWeek
  const scheduledDay = job.nextInvocation().getDay()

  if (expectedDays.includes(today) && scheduledDay != today) {
    start(true)
  } else {
    console.log('Manually start not needed, next invocation is: ' + job.nextInvocation().toString())
  }
}

bot.start((ctx) => {
  ctx.reply('Ma\'lumot uchun: /info')
})

bot.command('info', async (ctx) => {
  ctx.reply(await prettyInfo())
})

bot.launch()

checkStartupSet()
