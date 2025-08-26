(function(){
  function toButton(el){
    try {
      var label = el.textContent || el.innerText || '';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'zip-result btn btn-outline-primary w-100 text-start mb-1';
      btn.innerHTML = label;
      // preserve any useful data attributes
      for (var i=0; i<el.attributes.length; i++) {
        var attr = el.attributes[i];
        if (attr.name.startsWith('data-')) btn.setAttribute(attr.name, attr.value);
      }
      // custom handler
      btn.addEventListener('click', function(){
        // Implement our behavior here (emit event and optionally open modal)
        var detail = { label: label, data: Object.fromEntries(Array.from(btn.attributes).filter(a=>a.name.startsWith('data-')).map(a=>[a.name, a.value])) };
        var evt = new CustomEvent('zipResultSelected', { detail: detail });
        window.dispatchEvent(evt);
        // If schedule modal exists, show it
        try {
          var modalTrigger = document.querySelector('[data-bs-target="#scheduleModal"]');
          if (modalTrigger) {
            modalTrigger.click();
          }
        } catch(e){}
      });
      el.replaceWith(btn);
    } catch(e) {
      // no-op
    }
  }

  function processResults(root){
    if (!root) return;
    root.querySelectorAll('a').forEach(function(a){
      toButton(a);
    });
  }

  function init(){
    var containers = document.querySelectorAll('.zip-code-results');
    containers.forEach(function(c){
      processResults(c);
      var mo = new MutationObserver(function(muts){
        muts.forEach(function(m){
          m.addedNodes && m.addedNodes.forEach(function(n){
            if (n.nodeType === 1){ // element
              if (n.matches && n.matches('a')) toButton(n);
              else processResults(n);
            }
          });
        });
      });
      mo.observe(c, { childList: true, subtree: true });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
