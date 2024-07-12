const { Telegraf } = require('telegraf')
const schedule = require('node-schedule')
const parser = require('cron-parser')
const path = require('path'); 

require('dotenv').config({path: path.join(__dirname, '.env') })

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
    .filter(([key]) => !['sana', 'manba', 'juma'].includes(key))
    .map(([key, time]) => {
      const [hours, minutes] = time.split(':').map(Number)
      const date = new Date(dateToday)
      date.setHours(hours)
      date.setMinutes(minutes)
      return { key, date }
    })
}

async function sendTimeAlerts(todayData, startupCall) {
  if (!todayData || todayData.length === 0) {
    console.log('No data')
    sendMessage('Xatolik!')
    return
  }

  const info = `Ma'lumotlar yangilandi:\n\n ${await prettyInfo()}`
  console.log(`startupCall: ${startupCall}, startupInfo: ${startupInfo}`)
  console.log(info)

  if (startupCall) {
    if (startupInfo == 'on') sendMessage('Bot ishga tushdi')
  } else sendMessage(info)

  const now = new Date()
  todayData.forEach(({ date, key }) => {
    const alert = settings.alerts.find(alert => alert.key === key)
    const alertType = settings.alert_types.find(alert_type => alert_type.type === alert.alert_type)
    alertType.reminders_before.forEach(reminder => {
      const reminderDate = new Date(date.getTime() - reminder * 60 * 1000)
      if (reminderDate > now) {
        schedule.scheduleJob(`${key}-${reminder}`, reminderDate, async () => {
          let reminderMessage = ''

          if (reminder == 0) {
            if (key == 'quyosh')
              reminderMessage = 'Quyosh chiqdiyov oynadan qarachi'
            else
              reminderMessage = `Kirgan kirdi. ${alert.name} vaqti bo'ldi`
          } else {
            reminderMessage = `${alert.name}ga ${reminder} daqiqa qoldi`
            //if (key != 'quyosh')
            //reminderMessage = '🍇 Uzumlar chayilganmi? ' + reminderMessage
          }

          sendMessage(reminderMessage)
        })
        schedule.cancelJob("")
      }
    })
  })
}

async function sendMessage(message) {
  try {
    await bot.telegram.sendMessage(chatID, message)
  } catch(e) {
    console.log(e)
  }
}

async function today() {
  if (settings.source == "islom")
    return await data.islom(settings.islom.region)
  else if (settings.source == "aladhan") {
    const config = settings.aladhan
    return await data.aladhan(
      config.latitude,
      config.longitude,
      config.method
    )
  } else {
    console.log('Source is not correct')
    return null
  }
}

async function prettyInfo() {
  if (!currentData) {
    currentData = await today()
  }
  return currentData.sana.split('|')[1].trim() + '\n' +
    currentData.sana.split('|')[0].trim() + '\n\n' +
    Object.entries(currentData)
      .filter(([key]) => !['sana', 'manba', 'juma'].includes(key))
      .map(([key, time]) => {
        const alert = settings.alerts.find(alert => alert.key == key)
        let name = alert.name
        if (currentData.juma && "name_on_friday" in alert) {
          name = alert.name_on_friday
        }

        return `${name}: ${time} (${alert.alert_type})`
      }).join('\n') + `\n\n© ${currentData.manba}`
}

async function start(startupCall = false) {
  if (ignoreMainJob) {
    ignoreMainJob = false
    return
  }
  try {
    console.log('Setting scheduler for today\'s reminders')
    currentData = await today()
    const timeDates = createReminderObjects(currentData)
    sendTimeAlerts(timeDates, startupCall)
    console.log('Scheduler is set')
  } catch (e) {
    console.log(e)
    bot.telegram.sendMessage('Xatolik!')
  }
}

let ignoreMainJob = false
const job = schedule.scheduleJob("main", settings.scheduler_expresion, () => start())

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
  console.log('Command: start')
  ctx.reply('Ma\'lumot uchun: /info')
})

bot.command('info', async (ctx) => {
  console.log('Command: info')
  ctx.reply(await prettyInfo())
})

bot.command('dayoff', async (ctx) => {
  console.log('Command: dayoff')
  let length = Object.getOwnPropertyNames(schedule.scheduledJobs).length
  console.log("Job count: " + length)

  if (length == 1) {
    ignoreMainJob = true
    console.log("Todays main scheduler is ignored")
  } else {
    for (const jobName in schedule.scheduledJobs) {
      console.log("Job: " + jobName)
      if (jobName != "main")
        schedule.cancelJob(jobName)
    }
    console.log("Job count: " + Object.getOwnPropertyNames(schedule.scheduledJobs).length)
  }
  
  ctx.reply("Tushunarli")
})

setTimeout(() => {
    bot.launch()
    checkStartupSet()
}, 5000)


