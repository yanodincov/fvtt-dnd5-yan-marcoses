if (canvas.tokens.controlled.length !== 1) {
  return ui.notifications.error("Выберите один токен источника.");
}

const sourceToken = canvas.tokens.controlled[0];
const targetTokens = Array.from(game.user.targets);
if (targetTokens.length === 0) {
  return ui.notifications.error("Выберите хотя бы одну цель.");
}

const actor = sourceToken.actor;
const items = actor.items.filter(item => 
  ["spell", "feat", "weapon", "equipment"].includes(item.type) && 
  item.effects.some(e => e.transfer === false)
);

if (!items.length) {
  return ui.notifications.warn("Нет доступных способностей, предметов или заклинаний с эффектами.");
}

const itemOptions = items.map(item => `<option value="${item.id}">${item.name}</option>`).join("\n");

new Dialog({
  title: "Выбор эффекта",
  content: `
    <style>
      /* Общие стили для строк формы */
      .dialog-row {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
      }
      .dialog-row label {
        width: 100px;
        font-weight: bold;
      }
      .dialog-row .readonly-input {
        flex: 1;
        padding: 5px;
        border: 1px solid #ccc;
        background-color: transparent;
      }
      /* Контейнер для списка токенов (каждый в отдельном поле) */
      #targetTokensContainer {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      /* Стили для разделителя */
      .divider {
        border: none;
        border-top: 1px solid #ccc;
        margin: 15px 0;
      }
      /* Стили для списка эффектов */
      .effect-list label {
        display: flex;
        align-items: center;
        margin-bottom: 5px;
        font-style: italic;
        font-weight: normal;
        width: 100%;
      }
      .effect-list input[type="checkbox"] {
        margin-right: 10px;
      }
      /* Стили для кнопок диалога */
      .dialog-buttons {
        display: flex;
        justify-content: center;
        gap: 10px;
        padding-top: 10px;
        border-top: 1px solid #ccc;
      }
      .dialog-button, .dialog-buttons .dialog-button {
        height: 2.5rem !important;
        min-height: 2.5rem !important;
        max-height: 2.5rem !important;
        line-height: 2.5rem !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
    </style>
    <div>
      <div class="dialog-row">
        <label>Источник:</label>
        <input type="text" class="readonly-input" readonly value="${sourceToken.name}">
      </div>
      <div class="dialog-row">
        <label>Цели:</label>
        <div id="targetTokensContainer">
          ${targetTokens.map(t => `<input type="text" class="readonly-input" readonly value="${t.name}">`).join('')}
        </div>
      </div>
      <div class="dialog-row">
        <label>Предмет:</label>
        <select id="item-select" style="flex: 1; padding: 5px;">
          ${itemOptions}
        </select>
      </div>
      <hr class="divider">
      <div class="dialog-row" style="align-items: flex-start;">
        <label>Эффекты:</label>
        <div id="effect-list" class="effect-list" style="max-height: 200px; overflow-y: auto; flex: 1;"></div>
      </div>
    </div>
  `,
  buttons: {
    apply: {
      label: "Применить",
      callback: async (html) => {
        const itemId = html.find("#item-select").val();
        const item = actor.items.get(itemId);
        if (!item) return ui.notifications.error("Не удалось найти выбранный предмет.");
                
        const selectedEffects = html.find(".effect-checkbox:checked").map((_, el) => el.value).get();
        if (!selectedEffects.length) return ui.notifications.warn("Выберите хотя бы один эффект для применения.");
                
        for (const target of targetTokens) {
          const effectsToApply = item.effects.filter(e => selectedEffects.includes(e.id));
          for (const effect of effectsToApply) {
            const effectData = effect.toObject();
            effectData.disabled = false;
            await target.actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
          }
        }
        ui.notifications.info(`Эффекты применены к ${targetTokens.map(t => t.name).join(", ")}`);
      }
    },
    cancel: {
      label: "Отмена"
    }
  },
  render: (html) => {
    const itemSelect = html.find("#item-select");
    const effectList = html.find("#effect-list");
    
    function updateEffects() {
      const selectedItem = actor.items.get(itemSelect.val());
      if (!selectedItem) return;
      
      const effects = selectedItem.effects.filter(e => e.transfer === false);
      if (!effects.length) {
        effectList.html("<p>Нет применяемых эффектов</p>");
        return;
      }
      
      const effectItems = effects.map(e => `
        <label>
          <input type="checkbox" class="effect-checkbox" value="${e.id}" checked> ${e.name}
        </label>
      `).join("");
      
      effectList.html(effectItems);
    }
    
    itemSelect.on("change", updateEffects);
    updateEffects();
  }
}).render(true);