// Если целей нет, выводим предупреждение
if (!game.user.targets.size) {
    ui.notifications.warn("Пожалуйста, выберите хотя бы одну цель.");
    return;
  }
  
  const targets = Array.from(game.user.targets);
  
  // Таблица соответствия: русский тип урона → английское значение (для системы)
  const damageTypes = {
    "дробящий": "bludgeoning",
    "колющий": "piercing",
    "рубящий": "slashing",
    "огонь": "fire",
    "холод": "cold",
    "кислота": "acid",
    "яд": "poison",
    "некротический": "necrotic",
    "свет": "radiant",
    "молния": "lightning",
    "гром": "thunder",
    "силовой": "force",
    "психический": "psychic"
  };
  
  // Диалоговая форма для ввода параметров изменения ПЗ
  new Dialog({
    title: "Изменение ПЗ",
    content: `
      <form>
        <div class="form-group">
          <label>Тип изменения:</label>
          <select id="changeType">
            <option value="heal">Лечение</option>
            <option value="damage">Урон</option>
          </select>
        </div>
        <div class="form-group">
          <label>Тип урона:</label>
          <select id="damageType" disabled>
            ${Object.keys(damageTypes).map(type => `<option value="${damageTypes[type]}">${type}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Количество ходов:</label>
          <input type="number" id="rounds" value="1" min="1"/>
        </div>
        <div class="form-group">
          <label>Формула (например, 1d8+3):</label>
          <input type="text" id="formula" value="1d8+3"/>
        </div>
      </form>
      <script>
        document.getElementById("changeType").addEventListener("change", function() {
          document.getElementById("damageType").disabled = (this.value !== "damage");
        });
      </script>
    `,
    buttons: {
      applyEffect: {
        label: "Применить (по ходам)",
        callback: async (html) => {
          const changeType = html.find("#changeType")[0].value; // "heal" или "damage"
          const damageType = html.find("#damageType")[0].value;
          const rounds = parseInt(html.find("#rounds")[0].value);
          const formula = html.find("#formula")[0].value;
          applyEffect(targets, changeType, damageType, rounds, formula);
        }
      },
      applyInstant: {
        label: "Применить сразу",
        callback: async (html) => {
          const changeType = html.find("#changeType")[0].value;
          const damageType = html.find("#damageType")[0].value;
          const rounds = parseInt(html.find("#rounds")[0].value);
          const formula = html.find("#formula")[0].value;
          applyInstant(targets, changeType, damageType, rounds, formula);
        }
      }
    }
  }).render(true);
  
  //
  // Функция создания эффекта (по ходам) с использованием Effect Macro
  //
  async function applyEffect(targets, changeType, damageType, rounds, formula) {
    const changeTypeRus = changeType === "damage" ? "Урон" : "Лечение";
    const damageTypeRus = changeType === "damage"
      ? (Object.keys(damageTypes).find(key => damageTypes[key] === damageType) || damageType)
      : "";
    const effectName = changeType === "damage"
      ? `${changeTypeRus} (${damageTypeRus}) [${formula}]`
      : `${changeTypeRus} [${formula}]`;
    
    // Для каждого выбранного актёра создаём активный эффект
    for (const target of targets) {
      const actorUuid = target.actor.uuid;
      // Код для onTurnStart. Используем placeholder %%EFFECT_UUID%%, который заменим на реальный UUID эффекта.
      let onTurnStartScript = `
  const effectDoc = fromUuidSync("%%EFFECT_UUID%%");
  if (!effectDoc) {
    console.error("Ошибка: Эффект не найден");
    return;
  }
  const startRound = effectDoc.flags.custom?.startRound || 0;
  const totalRounds = effectDoc.flags.custom?.totalRounds || 0;
  const currentRound = game.combat ? game.combat.round : 0;
  const elapsed = currentRound - startRound;
  const remainingRounds = Math.max(totalRounds - elapsed, 0);
  console.log("Применение ${changeTypeRus} для", actor.name);
  let roll = await new Roll("${formula}").roll();
  let rollResult = roll.total;
  let finalValue = rollResult;
  console.log("Бросок:", rollResult);
  let tempHP = actor.system.attributes.hp.temp || 0;
  let currentHP = actor.system.attributes.hp.value;
  let maxHP = actor.system.attributes.hp.max;
  if ("${changeType}" === "damage") {
    if (actor.system.traits.di.value.has("${damageType}")) {
      ui.notifications.info(actor.name + " имеет иммунитет к " + "${damageTypeRus}" + ", урон отменён.");
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
    let newHP = Math.min(currentHP + finalValue, maxHP);
    await actor.update({ "system.attributes.hp.value": newHP });
  }
  let absorbedDamage = ("${changeType}" === "damage") ? (rollResult - finalValue) : 0;
  let message;
  if ("${changeType}" === "damage") {
    message = "${effectName} наносит " + actor.name + " " + finalValue + " ПЗ/" + absorbedDamage + " Бонус ПЗ и закончится через " + remainingRounds + " ход(ов)";
  } else {
    message = "${effectName} излечивает " + actor.name + " +" + finalValue + " ПЗ и закончится через " + remainingRounds + " ход(ов)";
  }
  ChatMessage.create({ content: message, whisper: ChatMessage.getWhisperRecipients("GM") });
  ui.notifications.info(message);
  console.log("Сообщение отправлено в чат");
      `;
      // Создаём эффект с флагами custom для хранения данных о раунде
      let effectData = {
        name: effectName,
        icon: "icons/svg/downgrade.svg",
        duration: { rounds },
        flags: {
          "effectmacro": { onTurnStart: { script: onTurnStartScript } },
          custom: { startRound: game.combat ? game.combat.round : 0, totalRounds: rounds }
        }
      };
      let effects = await target.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
      let effectDoc = effects[0];
      // Обновляем скрипт, заменяя placeholder %%EFFECT_UUID%% на реальный UUID эффекта
      let updatedScript = onTurnStartScript.replace(/%%EFFECT_UUID%%/g, effectDoc.uuid);
      await effectDoc.update({ "flags.effectmacro.onTurnStart.script": updatedScript });
      ui.notifications.info(effectName + " применён к " + target.actor.name + " на " + rounds + " ход(ов).");
    }
  }
  
  //
  // Функция мгновенного применения изменения ПЗ (без создания эффекта)
  //
  async function applyInstant(targets, changeType, damageType, rounds, formula) {
    const changeTypeRus = changeType === "damage" ? "Урон" : "Лечение";
    const damageTypeRus = changeType === "damage"
      ? (Object.keys(damageTypes).find(key => damageTypes[key] === damageType) || damageType)
      : "";
    const effectName = changeType === "damage"
      ? `${changeTypeRus} (${damageTypeRus}) [${formula}]`
      : `${changeTypeRus} [${formula}]`;
    for (const target of targets) {
      let totalChange = 0;
      for (let i = 0; i < rounds; i++) {
        const rollResult = (await new Roll(formula).roll()).total;
        totalChange += rollResult;
      }
      const result = await adjustHP(target.actor, changeType, damageType, totalChange, changeTypeRus, damageTypeRus);
      let message;
      if (changeType === "damage") {
        let parts = [];
        if (result.finalValue !== 0) parts.push(`– ${result.finalValue} ПЗ`);
        if (result.absorbedDamage !== 0) parts.push(`– ${result.absorbedDamage} Бонус ПЗ`);
        let damageText = parts.join(" / ");
        message = `${effectName} наносит ${target.actor.name} ${damageText} типом ${damageTypeRus}`;
      } else {
        message = `${effectName} излечивает ${target.actor.name} +${result.finalValue} ПЗ`;
      }
      ChatMessage.create({ content: message, whisper: ChatMessage.getWhisperRecipients("GM") });
      ui.notifications.info(message);
    }
  }
  
  //
  // Функция изменения ПЗ с учётом бонусных (временных) хит-поинтов, сопротивлений, уязвимостей и иммунитетов.
  // Возвращает объект: { finalValue, absorbedDamage }
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
      ui.notifications.info("Применено " + (changeTypeRus || "Урон") + (damageTypeRus ? " (" + damageTypeRus + ")" : "") + " " + finalValue + " для " + actor.name + ". Бонус ПЗ поглощено: " + absorbedDamage);
      return { finalValue, absorbedDamage };
    } else if (changeType === "heal") {
      let newHP = Math.min(currentHP + finalValue, maxHP);
      await actor.update({ "system.attributes.hp.value": newHP });
      ui.notifications.info("Применено " + (changeTypeRus || "Лечение") + " " + finalValue + " для " + actor.name);
      return { finalValue, absorbedDamage: 0 };
    }
  }