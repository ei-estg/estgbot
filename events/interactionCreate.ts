import { Events } from 'discord.js'

const err = {
  content:
    'Ocorreu um erro ao executar este comando <:feelsWeak:1192128377486852130>\nO erro foi reportado automaticamente aos devs.',
  ephemeral: true,
}

const cdMsgs = [
  'Espera um pouco antes de executares outro comando! <:feelsWeak:1192128377486852130>',
  'Não exageres nos comandos! <:burCat:1232019409816649768>',
]

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction: {
    client: { cmds: { get: (arg0: any) => any } }
    commandName: string
    deferred: any
    replied: any
    user: { lastCommand: number }

    deferReply: (arg0: { ephemeral: boolean }) => any
    followUp: (arg0: { content: string; ephemeral: boolean }) => any
    isChatInputCommand: () => any
    isAutocomplete: () => any
    reply: (arg0: { content: string; ephemeral: boolean }) => any
  }) {
    if (interaction.isAutocomplete()) {
      const cmd = interaction.client.cmds.get(interaction.commandName)
      if (cmd && cmd.autocomplete) await cmd.autocomplete(interaction)
      return
    }

    if (!interaction.isChatInputCommand()) return

    const cmd = interaction.client.cmds.get(interaction.commandName)
    try {
      if (
        interaction.user.lastCommand &&
        interaction.user.lastCommand + 2000 > Date.now()
      ) {
        return interaction.reply({
          content:
            cdMsgs[Math.floor(Math.random() * cdMsgs.length)] || cdMsgs[0],
          ephemeral: true,
        })
      } else interaction.user.lastCommand = Date.now()

      await cmd.execute(interaction)
    } catch (error) {
      console.error(error)
      if (interaction.replied || interaction.deferred)
        await interaction.followUp(err)
      else await interaction.reply(err)
    }
  },
}
