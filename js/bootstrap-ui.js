const BOOTSTRAP_ENHANCED_ATTR = "data-bootstrap-enhanced";

function addClasses(element, classes) {
  element.classList.add(...classes.filter(Boolean));
}

function getButtonClasses(button) {
  const text = button.textContent.trim();
  if (button.id === "battleBtn" || ["저장", "적용"].includes(text)) {
    return ["btn", "btn-primary", "btn-sm"];
  }
  if (text.includes("추가")) {
    return ["btn", "btn-success", "btn-sm"];
  }
  if (text.includes("삭제") || text.includes("비우기") || text.includes("제거")) {
    return ["btn", "btn-outline-danger", "btn-sm"];
  }
  if (text.includes("취소") || text.includes("초기화") || text.includes("복원")) {
    return ["btn", "btn-outline-secondary", "btn-sm"];
  }
  if (text.includes("수정") || text.includes("보기")) {
    return ["btn", "btn-outline-primary", "btn-sm"];
  }
  return ["btn", "btn-outline-secondary", "btn-sm"];
}

function enhanceButton(button) {
  if (button.hasAttribute(BOOTSTRAP_ENHANCED_ATTR)) {
    return;
  }
  addClasses(button, getButtonClasses(button));
  button.setAttribute(BOOTSTRAP_ENHANCED_ATTR, "true");
}

function enhanceField(field) {
  if (field.hasAttribute(BOOTSTRAP_ENHANCED_ATTR)) {
    return;
  }

  if (field.matches("input[type='checkbox'], input[type='radio']")) {
    field.classList.add("form-check-input");
  } else if (field.tagName === "SELECT") {
    field.classList.add("form-select", "form-select-sm");
  } else {
    field.classList.add("form-control", "form-control-sm");
  }

  field.setAttribute(BOOTSTRAP_ENHANCED_ATTR, "true");
}

function enhanceTable(table) {
  if (table.hasAttribute(BOOTSTRAP_ENHANCED_ATTR)) {
    return;
  }
  addClasses(table, ["table", "table-sm", "table-striped", "table-hover", "align-middle"]);
  if (!table.parentElement.classList.contains("table-responsive")) {
    const wrapper = document.createElement("div");
    wrapper.className = "table-responsive";
    table.parentElement.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  }
  table.setAttribute(BOOTSTRAP_ENHANCED_ATTR, "true");
}

function enhancePanel(panel) {
  if (panel.hasAttribute(BOOTSTRAP_ENHANCED_ATTR)) {
    return;
  }
  panel.classList.add("card", "shadow-sm");
  panel.setAttribute(BOOTSTRAP_ENHANCED_ATTR, "true");
}

function enhanceModalContent(content) {
  if (content.hasAttribute(BOOTSTRAP_ENHANCED_ATTR)) {
    return;
  }
  content.classList.add("shadow-lg", "rounded-3");
  content.setAttribute(BOOTSTRAP_ENHANCED_ATTR, "true");
}

function enhanceStaticContainers(root = document) {
  document.body.classList.add("bg-body-tertiary", "text-body");
  document.querySelector("h2")?.classList.add("h4", "fw-bold");
  document.querySelector(".nav")?.classList.add("d-flex", "flex-wrap", "gap-2");

  root.querySelectorAll(".data-toolbar").forEach(toolbar => {
    toolbar.classList.add("d-flex", "flex-wrap", "gap-2", "align-items-center");
  });
  root.querySelectorAll(".form-row").forEach(row => {
    row.classList.add("mb-2");
  });
  root.querySelectorAll(".panel").forEach(enhancePanel);
  root.querySelectorAll(".modal-content").forEach(enhanceModalContent);
}

function enhanceBootstrapUi(root = document) {
  enhanceStaticContainers(root);
  if (root instanceof Element) {
    if (root.matches("button")) {
      enhanceButton(root);
    }
    if (root.matches("input, select, textarea")) {
      enhanceField(root);
    }
    if (root.matches("table")) {
      enhanceTable(root);
    }
  }
  root.querySelectorAll("button").forEach(enhanceButton);
  root.querySelectorAll("input, select, textarea").forEach(enhanceField);
  root.querySelectorAll("table").forEach(enhanceTable);
}

document.addEventListener("DOMContentLoaded", () => {
  enhanceBootstrapUi();

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) {
          return;
        }
        enhanceBootstrapUi(node);
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
});
