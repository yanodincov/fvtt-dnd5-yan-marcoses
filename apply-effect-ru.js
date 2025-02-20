(async () => {
  // Объявляем константы и справочники

  // Типы урона с русскими подписями
  const damageTypes = {
    "Дробящий": "bludgeoning",
    "Колющий": "piercing",
    "Рубящий": "slashing",
    "Огонь": "fire",
    "Холод": "cold",
    "Кислота": "acid",
    "Яд": "poison",
    "Некротический": "necrotic",
    "Свет": "radiant",
    "Молния": "lightning",
    "Гром": "thunder",
    "Силовой": "force",
    "Психический": "psychic"
  };

  // Имена характеристик для категорий "Характеристики" и "Спасброски"
  const abilityNames = {
    str: "Сила",
    dex: "Ловкость",
    con: "Выносливость",
    int: "Интеллект",
    wis: "Мудрость",
    cha: "Харизма"
  };

  // Объект категорий для эффекта изменения параметров
  const categories = {
    "Общие": {
      "attributes.ac.value": "Класс брони",
      "bonuses.msak.attack": "Бонус к атаке (заклинания)",
      "bonuses.msak.damage": "Бонус к урону (заклинания)",
      "bonuses.mwak.attack": "Бонус к атаке (рукопашная)",
      "bonuses.mwak.damage": "Бонус к урону (рукопашная)",
      "bonuses.rwak.attack": "Бонус к атаке (дальняя)",
      "bonuses.rwak.damage": "Бонус к урону (дальняя)",
      "attributes.hp.value": "Здоровье",
      "attributes.hp.max": "Максимальное здоровье",
      "attributes.hp.temp": "Временное здоровье",
      "attributes.init.bonus": "Инициатива",
      "attributes.movement.walk": "Скорость"
    },
    "Характеристики": Object.fromEntries(
      Object.entries(abilityNames).map(([key, name]) => [`system.abilities.${key}.value`, name])
    ),
    "Навыки": {
      "skills.acr.value": "Акробатика",
      "skills.arc.value": "Магия",
      "skills.ath.value": "Атлетика",
      "skills.dec.value": "Обман",
      "skills.his.value": "История",
      "skills.ins.value": "Проницательность",
      "skills.itm.value": "Запугивание",
      "skills.inv.value": "Анализ",
      "skills.med.value": "Медицина",
      "skills.nat.value": "Природа",
      "skills.prc.value": "Внимательность",
      "skills.prf.value": "Выступление",
      "skills.per.value": "Убеждение",
      "skills.rel.value": "Религия",
      "skills.slt.value": "Ловкость рук",
      "skills.ste.value": "Скрытность",
      "skills.sur.value": "Выживание"
    },
    "Спасброски": Object.assign(
      {},
      Object.fromEntries(
        Object.entries(abilityNames).map(([key, name]) => [`system.abilities.${key}.bonuses.save`, name])
      ),
      { "system.abilities.all.bonuses.save": "Все" }
    ),
    "Устойчивость": (function(){
       let obj = { "system.traits.dr.all": "Все" };
       for (let [ru, en] of Object.entries(damageTypes)) {
         obj[`system.traits.dr.value.${en}`] = ru;
       }
       return obj;
    })(),
    "Неуязвимость": (function(){
       let obj = { "system.traits.di.all": "Все" };
       for (let [ru, en] of Object.entries(damageTypes)) {
         obj[`system.traits.di.value.${en}`] = ru;
       }
       return obj;
    })(),
    "Уязвимость": (function(){
       let obj = { "system.traits.dv.all": "Все" };
       for (let [ru, en] of Object.entries(damageTypes)) {
         obj[`system.traits.dv.value.${en}`] = ru;
       }
       return obj;
    })()
  };

  // Иконки для типов урона и эффектов
  const damageIcons = {
    "fire": "icons/svg/fire.svg",
    "cold": "icons/svg/frozen.svg",
    "acid": "icons/svg/acid.svg",
    "poison": "icons/svg/biohazard.svg",
    "necrotic": "icons/svg/poison.svg",
    "radiant": "icons/svg/sun.svg",
    "lightning": "icons/svg/lightning.svg",
    "thunder": "icons/svg/sound.svg",
    "force": "icons/svg/daze.svg",
    "psychic": "icons/svg/explosion.svg",
    "bludgeoning": "icons/svg/sword.svg",
    "piercing": "icons/svg/sword.svg",
    "slashing": "icons/svg/sword.svg"
  };

  const healIcon = "icons/svg/heal.svg";
  const buffIcon = "icons/svg/upgrade.svg";
  const debuffIcon = "icons/svg/downgrade.svg";

  // Для эффектов вне боя длительность раунда равна 6 секундам
  const roundSeconds = 6;

  /* ========= Функция для эффекта изменения параметров ========= */
  async function applyStatEffect(targetDoc, category, property, statValue, durationSec, endTime, transfer = false) {
    let isItem = (targetDoc.documentName === "Item");
    let actor, origin;
    if (!isItem && targetDoc.actor) {
      actor = targetDoc.actor;
      origin = actor.uuid;
    } else {
      origin = targetDoc.uuid;
    }
    let originalKey = property;
    if (["Характеристики", "Навыки"].includes(category)) {
      property = property.replace(".value", ".bonuses.value");
    }
    let effectName;
    if (["Устойчивость", "Неуязвимость", "Уязвимость"].includes(category)) {
      if (property.includes(".value.")) {
        const damageTypeCode = property.substring(property.lastIndexOf(".") + 1);
        property = property.substring(0, property.lastIndexOf("."));
        statValue = damageTypeCode;
      } else {
        statValue = 1;
      }
      effectName = `${category} [${categories[category][originalKey]}]`;
    } else {
      effectName = `Добавление к ${categories[category][originalKey] || originalKey}: ${statValue}`;
    }
    const propKey = property.startsWith("system.") ? property : `system.${property}`;
    let mode = CONST.ACTIVE_EFFECT_MODES.ADD;
    if (["Устойчивость", "Неуязвимость", "Уязвимость"].includes(category)) {
      mode = CONST.ACTIVE_EFFECT_MODES.CUSTOM;
    }
    const changes = [{ key: propKey, mode: mode, value: statValue }];
    let disabledVal = (!isItem && targetDoc.actor) ? false : (transfer ? false : true);
    let eIcon = buffIcon;
    if (String(statValue).trim().startsWith('-')) eIcon = debuffIcon;
    if (isItem && targetDoc.img) { eIcon = targetDoc.img; }
    let effectData = {
      name: effectName,
      icon: eIcon,
      changes: changes,
      origin: origin,
      disabled: disabledVal
    };
    if (durationSec > 0) {
      effectData.duration = { seconds: durationSec, startTime: game.time.worldTime, expiryTime: endTime };
    }
    effectData.transfer = transfer;
    effectData.flags = effectData.flags || {};
    effectData.flags.custom = effectData.flags.custom || {};
    effectData.flags.custom.targetUuid = targetDoc.uuid;
    effectData.flags.custom.isItem = isItem;
    if (!isItem) {
      effectData.flags.custom.startRound = game.combat ? game.combat.round : 0;
      effectData.flags.custom.totalRounds = 0;
    }
    if (!isItem && actor) {
      await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      ui.notifications.info(`${effectName} применено к ${actor.name}`);
    } else {
      await targetDoc.createEmbeddedDocuments("ActiveEffect", [effectData]);
      ui.notifications.info(`${effectName} применено к ${targetDoc.name}`);
    }
  }

  /* ========= Функция для периодического эффекта DOT (урон/лечения) ========= */
  async function applyDotPeriodicEffect(targetDoc, changeType, damageType, rounds, formula, transfer = false) {
    const targetUuid = targetDoc.uuid;
    const changeTypeRus = changeType === "damage" ? "Урон" : "Лечение";
    const damageTypeRus = changeType === "damage"
      ? (Object.entries(damageTypes).find(([ru, en]) => en === damageType)?.[0] || damageType)
      : "";
    let effectIcon = changeType === "heal" ? healIcon : (damageIcons[damageType] || debuffIcon);
    const isItem = (targetDoc.documentName === "Item");
    if (isItem && targetDoc.img) { effectIcon = targetDoc.img; }
    const effectName = changeType === "damage"
      ? `${changeTypeRus} ${damageTypeRus} [${formula}]`
      : `${changeTypeRus} [${formula}]`;
    let disabledVal = isItem ? (transfer ? false : true) : false;

    // Шаблон для применения эффекта (вызывается и в бою, и вне боя через таймер)
    const onTurnStartScript = `
if (!actor) {
  ui.notifications.warn("Эффект применяется не с актера, выполнение пропущено.");
  return;
}
let roll = await new Roll("${formula}").roll();
let rollResult = roll.total;
if ("${changeType}" === "damage") {
  await actor.applyDamage(rollResult, { damageType: "${damageType}" });
} else {
  let newHP = Math.min(actor.system.attributes.hp.value + rollResult, actor.system.attributes.hp.max);
  await actor.update({ "system.attributes.hp.value": newHP });
}
// Используем effect.duration?.remaining для расчёта оставшегося времени
let remainingSeconds = Number(effect.duration?.remaining) || 0;
let remainingRounds = Math.max(Math.floor(remainingSeconds / ${roundSeconds}), 0);
let message = \`<a href="#" data-uuid="\${effect.id}">\${effect.name}</a> \${"${changeType}" === "damage" ? "наносит" : "излечивает"} \${rollResult} \${"${changeType}" === "damage" ? "урона" : "здоровья"} и закончится через \${remainingRounds} ход(ов)\`;
ChatMessage.create({ content: message, whisper: ChatMessage.getWhisperRecipients("GM") });
ui.notifications.info(\`\${effect.name} применяет \${rollResult} \${"${changeType}" === "damage" ? "урона" : "здоровья"} к \${actor.name} и закончится через \${remainingRounds} ход(ов)\`);
    `;

    // Шаблон для старта таймера вне боя: таймер запускается только, если ещё не запущен
    const startTimerScript = `
if (!game.combat && effect.active) {
  if (!effect.flags.custom?.eventId) {
    console.log("Старт таймера для эффекта", effect.id);
    let eventId = abouttime.doEvery({ seconds: ${roundSeconds} }, async () => {
      ${onTurnStartScript}
    });
    effect.flags.custom = effect.flags.custom || {};
    effect.flags.custom.eventId = eventId;
    await effect.update({ "flags.custom.eventId": eventId });
  }
}
    `;

    // Шаблон для остановки таймера
    const stopTimerScript = `
if (effect.flags.custom?.eventId) {
  console.log("Остановка таймера для эффекта", effect.id);
  abouttime.reset(effect.flags.custom.eventId);
  effect.flags.custom.eventId = null;
  await effect.update({ "flags.custom.eventId": null });
}
    `;

    // Проставляем эффекту длительность в секундах и раундах
    const effectData = {
      name: effectName,
      icon: effectIcon,
      duration: { 
        rounds: rounds, 
        seconds: rounds * roundSeconds, 
        startTime: game.time.worldTime, 
        expiryTime: game.time.worldTime + rounds * roundSeconds 
      },
      disabled: disabledVal,
      flags: {
        effectmacro: {
          // При начале хода в бою: применяем эффект
          onTurnStart: { script: onTurnStartScript },
          // Вне боя: запускаем таймер, который вызывает эффект каждые roundSeconds секунд
          onCreate: { script: startTimerScript },
          onEnable: { script: startTimerScript },
          onCombatEnd: { script: startTimerScript },
          // При удалении/выключении эффекта или начале боя – останавливаем таймер
          onDelete: { script: stopTimerScript },
          onDisable: { script: stopTimerScript },
          onCombatStart: { script: stopTimerScript }
        },
        custom: {
          startRound: game.combat ? game.combat.round : 0,
          totalRounds: rounds,
          targetUuid: targetUuid,
          isItem: isItem
        }
      },
      transfer: transfer
    };

    let effects;
    if (!isItem && targetDoc.actor) {
      effects = await targetDoc.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    } else {
      effects = await targetDoc.createEmbeddedDocuments("ActiveEffect", [effectData]);
    }
    const effectDoc = effects[0];
    ui.notifications.info(`${effectName} применён к ${(!isItem && targetDoc.actor) ? targetDoc.actor.name : targetDoc.name} на ${rounds} раунд(ов).`);
  }

  /* ========= Диалог выбора параметров эффекта ========= */
  new Dialog({
    title: "Применение эффекта",
    content: `
      <style>
        form { display: flex; flex-direction: column; gap: 5px; }
        .form-group { display: flex; align-items: center; }
        .form-group label { width: 150px; font-weight: bold; }
        .form-group input:not([type="checkbox"]), .form-group select { width: 300px; box-sizing: border-box; }
        .form-col { display: flex; flex-direction: column; gap: 5px; }
        .dialog-buttons { margin-top: 10px; }
        .dialog-button { height: 40px !important; }
      </style>
      <form>
        <!-- Выбор типа цели -->
        <div class="form-group">
          <label for="targetType">Тип цели:</label>
          <select id="targetType">
            <option value="tokens">Выбранные токены</option>
            <option value="item">Предмет (UUID)</option>
          </select>
        </div>
        <!-- Блок для предмета -->
        <div id="itemUUIDGroup" class="form-col" style="display: none;">
          <div class="form-group">
            <label for="itemUUID">UUID предмета:</label>
            <input type="text" id="itemUUID" style="background-color: transparent;">
          </div>
          <div class="form-group">
            <label for="targetChoice">Цель:</label>
            <select id="targetChoice">
              <option value="owner">Владелец</option>
              <option value="action">Цель действий</option>
            </select>
          </div>
          <div class="form-group">
            <label>Название предмета:</label>
            <input type="text" id="itemNameFeedback" readonly style="width:300px; border:1px solid #ccc; padding:2px; background-color: transparent;" />
          </div>
        </div>
        <!-- Блок для выбранных токенов -->
        <div id="targetNamesGroup" class="form-col" style="display: none;">
          <div class="form-group">
            <label>Название токенов:</label>
            <div id="targetNamesContainer" style="width:300px; border:1px solid #ccc; padding:2px;"></div>
          </div>
        </div>
        <!-- Выбор типа эффекта -->
        <div class="form-group">
          <label for="effectType">Тип эффекта:</label>
          <select id="effectType">
            <option value="stats">Изменение параметров</option>
            <option value="dot">Урон/лечения</option>
          </select>
        </div>
        <!-- Секция изменения параметров -->
        <div id="statsSection" class="form-col" style="display: none;">
          <div class="form-group">
            <label for="category">Категория:</label>
            <select id="category">
              ${Object.keys(categories).map(cat => `<option value="${cat}">${cat}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label for="property">Свойство:</label>
            <select id="property"></select>
          </div>
          <div class="form-group">
            <label for="statValue">Значение (формула):</label>
            <input type="text" id="statValue" placeholder="+1, -2, 1d4, 15"/>
          </div>
        </div>
        <!-- Секция для урона/лечения (DOT) -->
        <div id="dotSection" class="form-col" style="display: none;">
          <div class="form-group">
            <label for="damageType">Тип урона:</label>
            <select id="damageType">
              <option value="heal">Лечение</option>
              ${Object.entries(damageTypes).map(([ru, en]) => `<option value="${en}">${ru}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label for="dotFormula">Формула:</label>
            <input type="text" id="dotFormula" placeholder="1d8+3"/>
          </div>
        </div>
        <div class="form-group">
          <label for="duration">Длительность (в раундах):</label>
          <input type="number" id="duration" value="10"/>
        </div>
        <div class="form-group">
          <label for="timeUnit">Единица измерения:</label>
          <select id="timeUnit">
            <option value="seconds">Секунды</option>
            <option value="minutes">Минуты</option>
            <option value="hours">Часы</option>
            <option value="rounds" selected>Раунды</option>
          </select>
        </div>
      </form>
    `,
    buttons: {
      apply: {
        label: "Применить",
        callback: async (html) => {
          const targetType = html.find("#targetType").val();
          const effectType = html.find("#effectType").val();
          let durationInput = parseInt(html.find("#duration").val());
          let durationSec = 0;
          let endTime = 0;
          if (!isNaN(durationInput) && durationInput > 0) {
            durationSec = durationInput * roundSeconds;
            endTime = game.time.worldTime + durationSec;
          }
          if (targetType === "tokens") {
            let targets = Array.from(game.user.targets);
            if (targets.length === 0) {
              ui.notifications.warn("Пожалуйста, выберите хотя бы один токен.");
              return;
            }
            if (effectType === "stats") {
              let category = html.find("#category").val();
              let property = html.find("#property").val();
              let statValue = html.find("#statValue").val();
              for (let target of targets) {
                await applyStatEffect(target, category, property, statValue, durationSec, endTime);
              }
            } else if (effectType === "dot") {
              let damageTypeVal = html.find("#damageType").val();
              let dotFormula = html.find("#dotFormula").val();
              let changeType = (damageTypeVal === "heal") ? "heal" : "damage";
              let rounds = parseInt(html.find("#duration").val());
              if (isNaN(rounds) || rounds < 1) rounds = 1;
              for (let target of targets) {
                await applyDotPeriodicEffect(target, changeType, damageTypeVal, rounds, dotFormula);
              }
            }
          } else if (targetType === "item") {
            let uuid = html.find("#itemUUID").val().trim();
            if (!uuid) {
              ui.notifications.warn("Пожалуйста, введите UUID предмета.");
              return;
            }
            let item = fromUuidSync(uuid);
            if (!item) {
              ui.notifications.error("Предмет не найден по указанному UUID.");
              return;
            }
            let targetChoice = html.find("#targetChoice").val();
            let transfer = (targetChoice === "owner");
            let target = item;
            if (effectType === "stats") {
              let category = html.find("#category").val();
              let property = html.find("#property").val();
              let statValue = html.find("#statValue").val();
              await applyStatEffect(target, category, property, statValue, durationSec, endTime, transfer);
            } else if (effectType === "dot") {
              let damageTypeVal = html.find("#damageType").val();
              let dotFormula = html.find("#dotFormula").val();
              let changeType = (damageTypeVal === "heal") ? "heal" : "damage";
              let rounds = parseInt(html.find("#duration").val());
              if (isNaN(rounds) || rounds < 1) rounds = 1;
              await applyDotPeriodicEffect(target, changeType, damageTypeVal, rounds, dotFormula, transfer);
            }
          }
        }
      }
    },
    render: (html) => {
      html.find("#category").on("change", function() {
        const cat = this.value;
        let entries = Object.entries(categories[cat]);
        if (["Спасброски", "Устойчивость", "Неуязвимость", "Уязвимость"].includes(cat)) {
          entries.sort((a, b) => {
            if(a[1] === "Все") return -1;
            if(b[1] === "Все") return 1;
            return 0;
          });
        }
        const optionsHtml = entries
          .map(([key, label]) => `<option value="${key}">${label}</option>`)
          .join("");
        html.find("#property").html(optionsHtml);
        if (["Устойчивость", "Неуязвимость", "Уязвимость"].includes(cat)) {
          html.find("#statValue").val("").prop("disabled", true).attr("placeholder", "Значение не требуется");
        } else {
          html.find("#statValue").prop("disabled", false).attr("placeholder", "+1, -2, 1d4, 15");
        }
      }).trigger("change");

      html.find("#effectType").on("change", function() {
        const type = this.value;
        html.find("#statsSection").toggle(type === "stats");
        html.find("#dotSection").toggle(type === "dot");
        if (type === "dot") {
          html.find("#timeUnit").val("rounds").prop("disabled", true);
        } else {
          html.find("#timeUnit").prop("disabled", false);
        }
      }).trigger("change");

      html.find("#targetType").on("change", function() {
        const val = this.value;
        if (val === "tokens") {
          html.find("#itemUUIDGroup").hide();
          const container = html.find("#targetNamesContainer");
          container.empty();
          Array.from(game.user.targets).forEach(t => {
            container.append(`<input type="text" readonly style="width:100%; margin-bottom:2px; border:1px solid #ccc; padding:2px; background-color: transparent;" value="${t.name}" />`);
          });
          html.find("#targetNamesGroup").show();
        } else {
          html.find("#targetNamesGroup").hide();
          html.find("#itemUUIDGroup").show();
        }
      }).trigger("change");

      html.find("#itemUUID").on("change", function() {
        const uuid = $(this).val().trim();
        const feedback = html.find("#itemNameFeedback");
        if (!uuid) {
          feedback.val("");
          return;
        }
        const item = fromUuidSync(uuid);
        if (item) {
          feedback.val(item.name).css("color", "");
        } else {
          feedback.val("Предмет не найден").css("color", "red");
        }
      });
    }
  }).render(true);
})();