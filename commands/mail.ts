import { EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import { defaultColor } from '../global.js'
import * as cheerio from 'cheerio'

import { db } from '../index'

const getEmailsWebsite = async () => {
  const req = await fetch('https://www.ipvc.pt/estg/a-escola/corpo-docente/')
  if (req.ok) return await req.text()
  throw Error()
}
interface Teacher {
  fullName: string
  email?: string
}
const getTeachersEmails = async () => {
  const emailsHtml = await getEmailsWebsite()
  const $ = cheerio.load(emailsHtml)

  const teachers: Teacher[] = []

  $('.link-005').each((_, el) => {
    const fullName = $(el).find('.link-005-item-title').text(),
      email = $(el)
        .find('.link-005-email a')
        .attr('href')
        ?.replace('mailto:', '')

    if (teachers.some((teacher) => teacher.fullName === fullName)) return
    teachers.push({
      fullName,
      email,
    })
  })

  return teachers
}
const normalize = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const getMailByTeacherName = async (fullName: string) => {
  const teachers = await getTeachersEmails()
  const nameTokens = normalize(fullName).toLowerCase().split(' ')

  return teachers
    .filter(({ fullName: teacherFullName }) =>
      nameTokens.every((nameInputToken) =>
        normalize(teacherFullName).toLowerCase().includes(nameInputToken),
      ),
    )
    .slice(0, 10)
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mail')
    .setDescription(
      'Encontra o email de um docente da ESTG através da sua disciplina ou nome',
    )
    .addSubcommand((sub) =>
      sub
        .setName('disciplina')
        .setDescription('Procurar pela disciplina do docente')
        .addStringOption((option) =>
          option
            .setName('disciplina')
            .setDescription('Disciplina')
            .setAutocomplete(true)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('nome')
        .setDescription('Procurar pelo nome do docente')
        .addStringOption((option) =>
          option
            .setName('nome')
            .setDescription('Nome do docente')
            .setRequired(true),
        ),
    ),
  autocomplete: async (interaction: any) => {
    const subcommand = interaction.options.getSubcommand()
    if (subcommand === 'disciplina') {
      const focusedOption = interaction.options.getFocused(true)
      if (focusedOption.name === 'disciplina') {
        const input = focusedOption.value as string
        const units = db
          .prepare(
            'SELECT curricularUnit FROM mails WHERE curricularUnit IS NOT NULL',
          )
          .all() as { curricularUnit: string }[]
        const allUnits = units.flatMap((u) =>
          u.curricularUnit.split('\r\n').map((s) => s.trim()),
        )
        const distinctUnits = [...new Set(allUnits)].sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase()),
        )
        const choices = distinctUnits
          .map((u) => ({ name: u, value: u }))
          .filter((choice) =>
            choice.name.toLowerCase().includes(input.toLowerCase()),
          )
          .slice(0, 25)
        await interaction.respond(choices)
      }
    }
  },
  async execute(interaction: {
    options: {
      get: (arg0: string) => { value: any }
      getSubcommand: () => string
    }

    deferReply: () => any
    editReply: (arg0: { content: string; embeds: EmbedBuilder[] }) => any
    reply: (arg0: string) => any
  }) {
    const embed = new EmbedBuilder().setColor(defaultColor).setTitle('Emails')

    const subcommand = interaction.options.getSubcommand()
    await interaction.deferReply()

    let query = 'SELECT * FROM mails WHERE '
    const params: string[] = []
    let conditions: string[] = []
    let searchName: string | undefined

    if (subcommand === 'nome') {
      searchName = interaction.options.get('nome').value as string
      const words = searchName.split(' ')

      conditions = words.map(() => 'fullName LIKE ? COLLATE NOCASE')
      params.push(...words.map((word) => `%${word}%`))
    } else if (subcommand === 'disciplina') {
      const disciplina = interaction.options.get('disciplina').value

      conditions = ['curricularUnit LIKE ? COLLATE NOCASE']
      params.push(`%${disciplina}%`)
    }
    query += conditions.join(' AND ') + ' ORDER BY fullName ASC LIMIT 7'

    const emails = db.prepare(query).all(params) as {
      fullName: string
      email: string
      curricularUnit?: string
    }[]

    let teachersToShow: { fullName: string; email?: string }[] = []

    if (emails.length) teachersToShow = emails
    else if (subcommand === 'nome' && searchName) {
      const teachers = await getMailByTeacherName(searchName)
      if (teachers.length) {
        teachersToShow = teachers
        teachers.forEach(({ fullName, email }) => {
          db.prepare(
            'INSERT OR IGNORE INTO mails (fullName, email, curricularUnit) VALUES (?, ?, NULL)',
          ).run(fullName, email)
        })
      }
    }

    if (teachersToShow.length) {
      teachersToShow.forEach(({ fullName, email }) => {
        embed.addFields({
          name: fullName,
          value: email || 'Email não encontrado',
        })
      })
      if (subcommand === 'disciplina')
        embed.addFields({
          name: '_ _',
          value:
            '⚠️ **Esta lista estará sempre sujeita a alterações**!\n-# Se encontrares algum erro, avisa a <@&766292682283810826>',
        })
    } else
      embed.setDescription(
        'Não foi possível encontrar o docente que procuras <:sadge:1232239200615665726>',
      )

    await interaction.editReply({ content: '', embeds: [embed] })
  },
}
