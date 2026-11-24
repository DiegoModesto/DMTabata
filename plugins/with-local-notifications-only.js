// O DMTabata só usa notificações LOCAIS (avisos de troca de fase agendados no aparelho).
// O plugin do expo-notifications adiciona a permissão de push remoto (aps-environment),
// que não é necessária e impede assinar o app com um time gratuito da Apple.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withLocalNotificationsOnly(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
