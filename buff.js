// Если нет выбранных целей, выводим предупреждение и выходим
if (game.user.targets.size === 0) {
    ui.notifications.warn("Пожалуйста, выберите хотя бы одну цель.");
    return;
  }
  
  // Получаем выбранные цели (токены) и определяем категории параметров
  const targets = Array.from(game.user.targets);
  const categories = {
    "Общие": {
      "attributes.ac.value": "Класс брони",
      "bonuses.mwak.attack": "Бонус к атаке (рукопашная)",
      "bonuses.mwak.damage": "Бонус к урону (рукопашная)",
      "bonuses.rwak.attack": "Бонус к атаке (дальняя)",
      "bonuses.rwak.damage": "Бонус к урону (дальняя)",
      "attributes.hp.max": "Максимальное ХП"
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
  
  // HTML-контент формы с небольшим CSS и скриптом для обновления списка свойств
  const content = `
    <style>
      .form-container { padding-bottom: 10px; }
      .form-group { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .form-group label { flex: 1; text-align: left; margin-right: 8px; }
      .form-group select, .form-group input { flex: 2; min-width: 100%; }
    </style>
    <form id="bonus-form" class="form-container">
      <div class="form-group">
        <label>Тип изменения:</label>
        <select name="modification-type">
          <option value="add">Добавление</option>
          <option value="override">Установление</option>
        </select>
      </div>
      <div class="form-group">
        <label>Категория:</label>
        <select name="category">
          ${Object.keys(categories).map(cat => `<option value="${cat}">${cat}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Свойство:</label>
        <select name="property"></select>
      </div>
      <div class="form-group" id="modifier-type-group" style="display: flex; visibility: hidden;">
        <label>Тип модификации:</label>
        <select name="modifier-type">
          <option value="value">Изменить значение</option>
          <option value="check">Изменить проверку</option>
        </select>
      </div>
      <div class="form-group">
        <label>Значение:</label>
        <input type="text" name="value" placeholder="+1, -2, 1d4, 15">
      </div>
      <div class="form-group">
        <label>Длительность:</label>
        <input type="number" name="duration" value="10">
      </div>
      <div class="form-group">
        <label>Единица измерения:</label>
        <select name="time-unit">
          <option value="seconds">Секунды</option>
          <option value="minutes">Минуты</option>
          <option value="hours">Часы</option>
          <option value="rounds">Раунды</option>
        </select>
      </div>
    </form>
    <script>
      function updatePropertyList() {
        const category = document.querySelector("[name='category']").value;
        const propertySelect = document.querySelector("[name='property']");
        const modifierGroup = document.getElementById("modifier-type-group");
        const props = ${JSON.stringify(categories)};
        
        propertySelect.innerHTML = Object.entries(props[category])
          .map(([key, label]) => \`<option value="\${key}">\${label}</option>\`).join('');
        
        modifierGroup.style.visibility = (category === "Характеристики" || category === "Навыки") ? "visible" : "hidden";
      }
      document.querySelector("[name='category']").addEventListener("change", updatePropertyList);
      updatePropertyList();
    </script>
  `;
  
  // Открываем диалог с формой
  new Dialog({
    title: "Применение изменения",
    content: content,
    buttons: {
      apply: {
        label: "Применить",
        callback: async (html) => {
          const form = html[0].querySelector("#bonus-form");
          const modType = form.elements["modification-type"].value;
          const category = form.elements.category.value;
          let property = form.elements.property.value;
          const value = form.elements.value.value;
          const duration = parseInt(form.elements.duration.value) || 10;
          const timeUnit = form.elements["time-unit"].value;
          
          // Если категория – "Характеристики" или "Навыки", меняем имя свойства
          if (category === "Характеристики" || category === "Навыки") {
            const modifier = form.elements["modifier-type"].value;
            property = property.replace(".value", `.bonuses.${modifier}`);
          }
          
          // Перевод длительности в секунды
          let durationSec = duration;
          if (timeUnit === "minutes") durationSec *= 60;
          else if (timeUnit === "hours") durationSec *= 3600;
          else if (timeUnit === "rounds") durationSec *= 6;
          
          const endTime = game.time.worldTime + durationSec;
          const mode = modType === "add" ? CONST.ACTIVE_EFFECT_MODES.ADD : CONST.ACTIVE_EFFECT_MODES.OVERRIDE;
          
          // Для каждой цели создаём активный эффект с указанными изменениями
          for (let target of game.user.targets) {
            const actor = target.actor;
            if (!actor) continue;
            
            const changeKey = `system.${property}`;
            const changes = [{ key: changeKey, mode: mode, value: value }];
            
            // Формируем название эффекта для наглядности
            const baseProp = property.replace('.bonuses.check','').replace('.bonuses.value','');
            const effectName = `${modType === "add" ? "Добавление" : "Установление"} к ${categories[category][baseProp] || property}: ${value}`;
            
            const effectData = {
              name: effectName,
              icon: 'icons/svg/aura.svg',
              changes: changes,
              duration: {
                seconds: durationSec,
                startTime: game.time.worldTime,
                expiryTime: endTime
              },
              origin: actor.uuid,
              disabled: false
            };
            
            await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
            ui.notifications.info(`${modType === "add" ? "Добавление" : "Установление"} к ${categories[category][property] || property}: ${value} применено к ${actor.name} на ${durationSec} секунд.`);
          }
        }
      },
      cancel: { label: "Отмена" }
    },
    default: "apply"
  }).render(true);