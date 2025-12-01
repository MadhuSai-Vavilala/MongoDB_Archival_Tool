// logoDisplay.js
const RESET  = "\x1b[0m";

// Border blinking teal (#2A838A)
const BORDER = "\x1b[5;36m"; // 36 = cyan/teal shade

// Logo bright orange-yellow (#FF9900)
const LOGO   = "\x1b[38;5;214m";

// Text dark orange (#A7680B)
const TEXT   = "\x1b[38;5;166m";

const HIGHLIGHT = "\x1b[38;5;166m"; // dark orange (#A7680B)
const INFO = "\x1b[38;5;34m"; // green for general info lines

function showLogo() {
  console.log(`
${BORDER} ╔═══════════════════════════════════════════════════════════════════════════════════════════════╗${RESET}
${BORDER} ║${RESET}                                                                                               ${BORDER}║${RESET}
${BORDER} ║${RESET}${TEXT}        ███╗░░░███╗░█████╗░███╗░░██╗░██████╗░░█████╗░████████╗██████╗░██╗███╗░░░███╗           ${BORDER}║${RESET}
${BORDER} ║${RESET}${TEXT}        ████╗░████║██╔══██╗████╗░██║██╔════╝░██╔══██╗╚══██╔══╝██╔══██╗██║████╗░████║           ${BORDER}║${RESET}
${BORDER} ║${RESET}${TEXT}        ██╔████╔██║██║░░██║██╔██╗██║██║░░██╗░██║░░██║░░░██║░░░██████╔╝██║██╔████╔██║           ${BORDER}║${RESET}
${BORDER} ║${RESET}${TEXT}        ██║╚██╔╝██║██║░░██║██║╚████║██║░░╚██╗██║░░██║░░░██║░░░██╔══██╗██║██║╚██╔╝██║           ${BORDER}║${RESET}
${BORDER} ║${RESET}${TEXT}        ██║░╚═╝░██║╚█████╔╝██║░╚███║╚██████╔╝╚█████╔╝░░░██║░░░██║░░██║██║██║░╚═╝░██║           ${BORDER}║${RESET}
${BORDER} ║${RESET}${TEXT}        ╚═╝░░░░░╚═╝░╚════╝░╚═╝░░╚══╝░╚═════╝░░╚════╝░░░░╚═╝░░░╚═╝░░╚═╝╚═╝╚═╝░░░░░╚═╝           ${BORDER}║${RESET}
${BORDER} ║${RESET}${TEXT}                                                                                               ${BORDER}║${RESET}
${BORDER} ║${RESET}${INFO}                          ** M O N G O D B   A R C H I V E R **                                ${BORDER}║${RESET}
${BORDER} ║${RESET}${LOGO}          ─────────────────────────────────<✂>──────────────────────────────────               ${BORDER}║${RESET}
${BORDER} ║${RESET}${INFO}                 ❄ C H O O S E   •   F R E E Z E   •   A R C H I V E  ❄                        ${BORDER}║${RESET}
${BORDER} ║${RESET}${LOGO}                    ──────────────────────────────────────────────                             ${BORDER}║${RESET}
${BORDER} ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝${RESET}
`);

  //console.log(`${TEXT}\nMongoTrim – Intelligent Data Aging for MongoDB${RESET}\n`);
  console.log(`MongoTrim - your intelligent & selective data aging automation for MongoDB ${RESET}\n`);


  console.log(`${INFO}  • The ${HIGHLIGHT}'MongoTrim'${INFO} offers safe archival, pruning, backups, maintenance-window scheduling, GUI monitoring, and JSON logs${RESET}`);
  console.log(`${INFO}  • Run ${HIGHLIGHT}node index.js --help${INFO} to explore available commands.${RESET}`);
  console.log(`${INFO}  • Refer to the project git documentation ${HIGHLIGHT}https://github.com/MadhuSai-Vavilala/MongoDB_Archival_Tool${INFO} to get a better understanding of the tool and its use cases.${RESET}\n`);
}

module.exports = { showLogo };
