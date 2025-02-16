// Определяем категории для параметров (без изменений)
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
  
  // HTML-контент формы
  const content = `
    <style>
      .form-container { padding-bottom: 10px; }
      .form-group { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .form-group label { flex: 1; text-align: left; margin-right: 8px; }
      .form-group select, .form-group input { flex: 2; min-width: 100%; }
    </style>
    <form id="bonus-form" class="form-container">
      <!-- Поле ввода UUID предмета или магии -->
      <div class="form-group">
        <label>ID предмета или магии:</label>
        <input type="text" name="item-id" placeholder="Введите UUID">
      </div>
      <!-- Область для обратной связи по введённому UUID -->
      <div class="form-group">
        <div id="item-feedback" style="font-style: italic; text-align: center;"></div>
      </div>
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
      <!-- Блок для выбора типа модификации (виден для категорий "Характеристики" и "Навыки") -->
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
      <!-- Если длительность не указана, эффект будет постоянным -->
      <div class="form-group">
        <label>Длительность (оставьте пустым для постоянного эффекта):</label>
        <input type="number" name="duration" placeholder="Длительность">
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
  `;
  
  // Создаем диалог
  new Dialog({
    title: "Применение изменения к предмету/магии",
    content: content,
    buttons: {
      apply: {
        label: "Применить",
        callback: async (html) => {
          const form = html[0].querySelector("#bonus-form");
  
          // Считываем введённый UUID
          const itemId = form.elements["item-id"].value.trim();
          if (!itemId) {
            ui.notifications.warn("Пожалуйста, введите UUID предмета или магии.");
            return;
          }
  
          // Поиск объекта по UUID с использованием fromUuidSync
          const item = fromUuidSync(itemId);
          if (!item) {
            ui.notifications.error("Предмет или магия не найдены по указанному UUID.");
            return;
          }
  
          // Выводим уведомление с именем найденного объекта
          ui.notifications.info(`Найден: ${item.name}`);
  
          const modType = form.elements["modification-type"].value;
          const category = form.elements.category.value;
          let property = form.elements.property.value;
          const value = form.elements.value.value;
  
          // Если категория – "Характеристики" или "Навыки", корректируем имя свойства
          if (category === "Характеристики" || category === "Навыки") {
            const modifier = form.elements["modifier-type"].value;
            property = property.replace(".value", `.bonuses.${modifier}`);
          }
  
          // Обработка длительности: если поле пустое – эффект без временного ограничения
          const durationInput = form.elements.duration.value;
          let durationSec = 0;
          let endTime = 0;
          if (durationInput && !isNaN(parseInt(durationInput))) {
            let duration = parseInt(durationInput);
            const timeUnit = form.elements["time-unit"].value;
            if (timeUnit === "minutes") duration *= 60;
            else if (timeUnit === "hours") duration *= 3600;
            else if (timeUnit === "rounds") duration *= 6;
            durationSec = duration;
            endTime = game.time.worldTime + durationSec;
          }
  
          const mode = modType === "add" ? CONST.ACTIVE_EFFECT_MODES.ADD : CONST.ACTIVE_EFFECT_MODES.OVERRIDE;
          const changeKey = `system.${property}`;
          const changes = [{ key: changeKey, mode: mode, value: value }];
  
          // Формируем наглядное название эффекта
          const baseProp = property.replace('.bonuses.check','').replace('.bonuses.value','');
          const effectName = `${modType === "add" ? "Добавление" : "Установление"} к ${categories[category][baseProp] || property}: ${value}`;
  
          // Собираем данные активного эффекта
          const effectData = {
            name: effectName,
            icon: 'icons/svg/aura.svg',
            changes: changes,
            origin: item.uuid,
            disabled: false
          };
  
          // Если длительность указана, добавляем соответствующие параметры
          if (durationSec > 0) {
            effectData.duration = {
              seconds: durationSec,
              startTime: game.time.worldTime,
              expiryTime: endTime
            };
          }
  
          // Создаем активный эффект на найденном объекте
          await item.createEmbeddedDocuments("ActiveEffect", [effectData]);
          ui.notifications.info(`${modType === "add" ? "Добавление" : "Установление"} к ${categories[category][baseProp] || property}: ${value} применено к ${item.name}`);
        }
      },
      cancel: { label: "Отмена" }
    },
    // В render‑колбэке инициализируем динамику формы
    render: (html) => {
      // Функция обновления списка свойств в зависимости от выбранной категории
      function updatePropertyList() {
        let category = html.find("[name='category']").val();
        let propertySelect = html.find("[name='property']");
        let modifierGroup = html.find("#modifier-type-group");
        let props = categories[category];
        let optionsHtml = "";
        for (let key in props) {
          if (props.hasOwnProperty(key)) {
            optionsHtml += `<option value="${key}">${props[key]}</option>`;
          }
        }
        propertySelect.html(optionsHtml);
        // Для категорий "Характеристики" и "Навыки" показываем выбор типа модификации
        if (category === "Характеристики" || category === "Навыки") {
          modifierGroup.css("visibility", "visible");
        } else {
          modifierGroup.css("visibility", "hidden");
        }
      }
      html.find("[name='category']").on("change", updatePropertyList);
      updatePropertyList();
  
      // Обработчик изменения поля UUID
      html.find("[name='item-id']").on("change", function() {
        let itemId = $(this).val().trim();
        let feedback = html.find("#item-feedback");
        if (!itemId) {
          feedback.text("");
          return;
        }
        // Используем fromUuidSync для поиска объекта
        let item = fromUuidSync(itemId);
        if (item) {
          feedback.text("Найден: " + item.name).css("color", "green");
        } else {
          feedback.text("Предмет или магия не найдены по указанному UUID.").css("color", "red");
        }
      });
    },
    default: "apply"
  }).render(true);