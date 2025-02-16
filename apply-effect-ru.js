(async () => {
  // Таблица соответствия характеристик (ключи в нижнем регистре)
  const categories = {
    "Общие": {
      "attributes.ac.value": "Класс брони",
      "bonuses.mwak.attack": "Бонус к атаке (рукопашная)",
      "bonuses.mwak.damage": "Бонус к урону (рукопашная)",
      "bonuses.rwak.attack": "Бонус к атаке (дальняя)",
      "bonuses.rwak.damage": "Бонус к урону (дальняя)",
      "attributes.hp.max": "Максимальное хп"
    },
    "Характеристики": {
      "abilities.str.value": "Сила",
      "abilities.dex.value": "Ловкость",
      "abilities.con.value": "Выносливость",
      "abilities.int.value": "Интеллект",
      "abilities.wis.value": "Мудрость",
      "abilities.cha.value": "Харизма"
    },
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
    }
  };

  // Таблица типов урона (опции в нижнем регистре)
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

  // Если активен модуль SimpleCalendar, получаем длительность раунда, иначе 6 секунд по умолчанию
  let roundSeconds = 6;
  if (game.modules.get("foundryvtt-simple-calendar")?.active) {
    roundSeconds = SimpleCalendar.api.getCurrentSeason().roundTime || 6;
  }

  /* ========= Вспомогательные функции ========= */

  async function applyStatEffect(targetDoc, category, property, statValue, durationSec, endTime, transfer = false) {
    let isItem = (targetDoc.documentName === "Item");
    let actor, origin;
    if (!isItem && targetDoc.actor) {
      actor = targetDoc.actor;
      origin = actor.uuid;
    } else {
      origin = targetDoc.uuid;
    }
    if (["Характеристики", "Навыки"].includes(category)) {
      property = property.replace(".value", ".bonuses.value");
    }
    const baseProp = property.replace('.bonuses.check', '').replace('.bonuses.value', '');
    const effectName = `Добавление к ${categories[category][baseProp] || property}: ${statValue}`;
    const changes = [{ key: `system.${property}`, mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: statValue }];
    let disabledVal = (!isItem && targetDoc.actor) ? false : (transfer ? false : true);
    let effectData = {
      name: effectName,
      icon: 'icons/svg/aura.svg',
      changes: changes,
      origin: origin,
      disabled: disabledVal
    };
    if (durationSec > 0) {
      effectData.duration = {
        seconds: durationSec,
        startTime: game.time.worldTime,
        expiryTime: endTime
      };
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

  async function applyDotPeriodicEffect(targetDoc, changeType, damageType, rounds, formula, transfer = false) {
    const targetUuid = targetDoc.uuid;
    const changeTypeRus = changeType === "damage" ? "Урон" : "Лечение";
    const damageTypeRus = changeType === "damage"
      ? (Object.entries(damageTypes).find(([ru, en]) => en === damageType)?.[0] || damageType)
      : "";
    const effectName = changeType === "damage"
      ? `${changeTypeRus} (${damageTypeRus}) [${formula}]`
      : `${changeTypeRus} [${formula}]`;
    const adjustedRounds = rounds;
    let isItem = (targetDoc.documentName === "Item");
    let disabledVal = !isItem ? false : (transfer ? false : true);
    
    // Новый onTurnStartScript: Если actor == null, выводим предупреждение и пропускаем выполнение.
    let onTurnStartScript = `
if (!actor) {
  ui.notifications.warn("Эффект применяется не с актера, выполнение пропущено.");
  return;
}
const startRound = effect.flags.custom.startRound || 0;
const totalRounds = effect.flags.custom.totalRounds || 0;
const currentRound = game.combat ? game.combat.round : 0;
const elapsed = currentRound - startRound;
const remainingRounds = Math.max(totalRounds - elapsed, 0);
console.log("Применение " + effect.name + " для " + actor.name);
let roll = await new Roll("${formula}").roll();
let rollResult = roll.total;
let finalValue = rollResult;
console.log("Бросок: " + rollResult);
let tempHP = actor.system.attributes.hp.temp || 0;
let currentHP = actor.system.attributes.hp.value;
if ("${changeType}" === "damage") {
  if (actor.system.traits.di.value.has("${damageType}")) {
    ui.notifications.info(actor.name + " имеет иммунитет к ${damageTypeRus}, урон отменён.");
    return;
  }
  if (actor.system.traits.dr.value.has("${damageType}")) {
    finalValue = Math.floor(finalValue / 2);
  } else if (actor.system.traits.dv.value.has("${damageType}")) {
    finalValue *= 2;
  }
  if (tempHP > 0) {
    if (tempHP >= finalValue) {
      tempHP -= finalValue;
      finalValue = 0;
    } else {
      finalValue -= tempHP;
      tempHP = 0;
    }
  }
  let newHP = Math.max(currentHP - finalValue, 0);
  await actor.update({
    "system.attributes.hp.value": newHP,
    "system.attributes.hp.temp": tempHP
  });
} else if ("${changeType}" === "heal") {
  let newHP = Math.min(currentHP + finalValue, actor.system.attributes.hp.max);
  await actor.update({ "system.attributes.hp.value": newHP });
}
let absorbedDamage = ("${changeType}" === "damage") ? (rollResult - finalValue) : 0;
let message;
if ("${changeType}" === "damage") {
  message = effect.name + " наносит " + actor.name + " " + finalValue + " пз/" + absorbedDamage + " бонус пз и закончится через " + remainingRounds + " ход(ов)";
} else {
  message = effect.name + " излечивает " + actor.name + " +" + finalValue + " пз и закончится через " + remainingRounds + " ход(ов)";
}
ChatMessage.create({ content: message, whisper: ChatMessage.getWhisperRecipients("GM") });
ui.notifications.info(message);
console.log("Сообщение отправлено в чат");
    `;
    const effectData = {
      name: effectName,
      icon: "icons/svg/downgrade.svg",
      duration: { rounds: adjustedRounds },
      disabled: disabledVal,
      flags: {
        "effectmacro": { onTurnStart: { script: onTurnStartScript } },
        custom: {
          startRound: game.combat ? game.combat.round : 0,
          totalRounds: adjustedRounds,
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
    const updatedScript = onTurnStartScript.replace(/%%EFFECT_UUID%%/g, effectDoc.uuid);
    await effectDoc.update({ "flags.effectmacro.onTurnStart.script": updatedScript });
    let targetName = (!isItem && targetDoc.actor) ? targetDoc.actor.name : targetDoc.name;
    ui.notifications.info(`${effectName} применено к ${targetName} на ${adjustedRounds} раунд(ов).`);
  }

  async function applyDotInstantEffect(targetDoc, changeType, damageType, rounds, formula, transfer = false) {
    let target;
    let isItem = (targetDoc.documentName === "Item");
    if (!isItem && targetDoc.actor) {
      target = targetDoc.actor;
    } else {
      target = targetDoc;
      if (transfer) {
        if (targetDoc.actor) {
          target = targetDoc.actor;
        } else {
          ui.notifications.error("Эффект отмечен как transfer, но у предмета нет владельца.");
          return;
        }
      }
    }
    const changeTypeRus = changeType === "damage" ? "Урон" : "Лечение";
    const damageTypeRus = changeType === "damage"
      ? (Object.entries(damageTypes).find(([ru, en]) => en === damageType)?.[0] || damageType)
      : "";
    const effectName = changeType === "damage"
      ? `${changeTypeRus} (${damageTypeRus}) [${formula}]`
      : `${changeTypeRus} [${formula}]`;
    let totalChange = 0;
    for (let i = 0; i < rounds; i++) {
      let roll = await new Roll(formula).roll();
      totalChange += roll.total;
    }
    let result = await adjustHP(target, changeType, damageType, totalChange, changeTypeRus, damageTypeRus);
    let message;
    if (changeType === "damage") {
      let parts = [];
      if (result.finalValue !== 0) parts.push(`– ${result.finalValue} пз`);
      if (result.absorbedDamage !== 0) parts.push(`– ${result.absorbedDamage} бонус пз`);
      let damageText = parts.join(" / ");
      message = `${effectName} наносит ${target.name} ${damageText} типом ${damageTypeRus}`;
    } else {
      message = `${effectName} излечивает ${target.name} +${result.finalValue} пз`;
    }
    ChatMessage.create({ content: message, whisper: ChatMessage.getWhisperRecipients("GM") });
    ui.notifications.info(message);
  }

  async function adjustHP(actor, changeType, damageType, value, changeTypeRus = "", damageTypeRus = "") {
    if (!actor) return;
    const originalValue = value;
    let finalValue = value;
    let tempHP = actor.system.attributes.hp.temp || 0;
    let currentHP = actor.system.attributes.hp.value;
    let maxHP = actor.system.attributes.hp.max;
    if (changeType === "damage") {
      if (actor.system.traits.di.value.has(damageType)) {
        ui.notifications.info(actor.name + " имеет иммунитет к " + (damageTypeRus || damageType) + ", урон отменён.");
        return { finalValue: 0, absorbedDamage: 0 };
      }
      if (actor.system.traits.dr.value.has(damageType)) {
        finalValue = Math.floor(value / 2);
      } else if (actor.system.traits.dv.value.has(damageType)) {
        finalValue = value * 2;
      }
      if (tempHP > 0) {
        if (tempHP >= finalValue) {
          tempHP -= finalValue;
          finalValue = 0;
        } else {
          finalValue -= tempHP;
          tempHP = 0;
        }
      }
      let newHP = Math.max(currentHP - finalValue, 0);
      await actor.update({
        "system.attributes.hp.value": newHP,
        "system.attributes.hp.temp": tempHP
      });
      let absorbedDamage = originalValue - finalValue;
      ui.notifications.info("Применено " + (changeTypeRus || "Урон") + (damageTypeRus ? " (" + damageTypeRus + ")" : "") + " " + finalValue + " для " + actor.name + ". Бонус пз поглощено: " + absorbedDamage);
      return { finalValue, absorbedDamage };
    } else if (changeType === "heal") {
      let newHP = Math.min(currentHP + finalValue, maxHP);
      await actor.update({ "system.attributes.hp.value": newHP });
      ui.notifications.info("Применено " + (changeTypeRus || "Лечение") + " " + finalValue + " для " + actor.name);
      return { finalValue, absorbedDamage: 0 };
    }
  }

  /* ========= Форма диалога ========= */
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
          <label for="duration">Длительность:</label>
          <input type="number" id="duration" value="10"/>
        </div>
        <div class="form-group">
          <label for="timeUnit">Единица измерения:</label>
          <select id="timeUnit">
            <option value="seconds">Секунды</option>
            <option value="minutes">Минуты</option>
            <option value="hours">Часы</option>
            <option value="rounds">Раунды</option>
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
          let timeUnit = html.find("#timeUnit").val();
          let durationSec = 0;
          let endTime = 0;
          if (!isNaN(durationInput) && durationInput > 0) {
            if (timeUnit === "minutes") durationSec = durationInput * 60;
            else if (timeUnit === "hours") durationSec = durationInput * 3600;
            else if (timeUnit === "rounds") durationSec = durationInput * roundSeconds;
            else durationSec = durationInput;
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
      },
      applyInstant: {
        label: "Применить сразу",
        callback: async (html) => {
          const targetType = html.find("#targetType").val();
          let rounds = parseInt(html.find("#duration").val());
          if (isNaN(rounds) || rounds < 1) rounds = 1;
          let damageTypeVal = html.find("#damageType").val();
          let dotFormula = html.find("#dotFormula").val();
          let changeType = (damageTypeVal === "heal") ? "heal" : "damage";
          if (targetType === "tokens") {
            let targets = Array.from(game.user.targets);
            if (targets.length === 0) {
              ui.notifications.warn("Пожалуйста, выберите хотя бы один токен.");
              return;
            }
            for (let target of targets) {
              await applyDotInstantEffect(target, changeType, damageTypeVal, rounds, dotFormula);
            }
          } else if (targetType === "item") {
            ui.notifications.warn("Для предметов доступна только периодическая версия DOT эффекта.");
          }
        }
      }
    },
    render: (html) => {
      function updateApplyInstantVisibility() {
        const effectType = html.find("#effectType").val();
        const targetType = html.find("#targetType").val();
        if (effectType === "dot" && targetType === "tokens") {
          html.closest(".dialog").find("button[data-button='applyInstant']").show();
        } else {
          html.closest(".dialog").find("button[data-button='applyInstant']").hide();
        }
      }
      
      html.find("#category").on("change", function() {
        const cat = this.value;
        const propSelect = html.find("#property");
        const optionsHtml = Object.entries(categories[cat])
          .map(([key, label]) => `<option value="${key}">${label}</option>`)
          .join("");
        propSelect.html(optionsHtml);
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
        updateApplyInstantVisibility();
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
        updateApplyInstantVisibility();
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