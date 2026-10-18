"use strict";
/* Panel de Luca (18-oct-2026).
   Sin sesion solo se ve la pantalla de entrar. Con sesion lee panel.estado / panel.fotos y manda lo que Luca hace
   (editar contacto, guardar textos, OK) como filas en panel.acciones; el servidor las aplica y anota el resultado.
   En el codigo van solo la URL y la clave PUBLICA del proyecto (publishable): sin sesion no abre nada. */
var SUPA_URL = "https://nvtjjzqzzfxegdhfehmo.supabase.co";
var SUPA_KEY = "sb_publishable_mA_Qr3XEhLEmaK0GhIGUFw_f9Fn6DEp";
var REFRESCO_MS = 30000;

var hashInicial = location.hash || "";
var llegoPorLink = /(^|[#&])type=(recovery|magiclink|invite|signup)(&|$)/.test(hashInicial);
var errorDeLink = (/error_description=([^&]+)/.exec(hashInicial) || [])[1];

var db = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
  db: {schema: "panel"},
  auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true}
});

function $(s) { return document.querySelector(s); }
function el(tag, attrs, hijos) {
  var e = document.createElement(tag);
  Object.keys(attrs || {}).forEach(function (k) {
    if (k === "texto") e.textContent = attrs[k];
    else if (k === "clase") e.className = attrs[k];
    else e.setAttribute(k, attrs[k]);
  });
  (hijos || []).forEach(function (h) { e.appendChild(h); });
  return e;
}
function esc(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
    return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
  });
}
function hace(s) {
  if (s == null) return "—";
  return s < 60 ? "hace " + Math.round(s) + " s" : s < 3600 ? "hace " + Math.round(s / 60) + " min"
    : s < 86400 ? "hace " + Math.floor(s / 3600) + " h " + String(Math.round((s % 3600) / 60)).padStart(2, "0")
    : "hace " + Math.floor(s / 86400) + " d";
}
function num(v, suf) { return v == null ? "—" : v + (suf || ""); }
function guardarLocal(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento: no pasa nada */ } }
function leerLocal(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

/* ── pantallas ───────────────────────────────────────────────────────────────────────────── */
var pantalla = null;
var vista = leerLocal("panel-vista") === "textos" ? "textos" : "tablero";
function claseVista() { return vista === "tablero" ? "v-tablero-pc" : "v-textos"; }

function mostrar(cual) {
  var antes = pantalla;
  pantalla = cual;
  ["cargando", "entrar", "clave"].forEach(function (p) { $("#p-" + p).hidden = (p !== cual); });
  $("#p-app").hidden = (cual !== "app");
  document.body.className = cual === "app" ? claseVista() : "";
  if (cual === "app") { if (antes !== "app") abrirApp(); } else { cerrarApp(); }
}

/* ── entrar ──────────────────────────────────────────────────────────────────────────────── */
var claveElegida = false;

$("#f-entrar").addEventListener("submit", function (ev) {
  ev.preventDefault();
  var b = $("#b-entrar"), msg = $("#msg-entrar");
  b.disabled = true; msg.className = "msg"; msg.textContent = "Entrando…";
  db.auth.signInWithPassword({email: $("#correo").value.trim(), password: $("#clave").value}).then(function (r) {
    b.disabled = false;
    if (r.error) {
      msg.className = "msg mal";
      msg.textContent = /rate|too many|demasiad/i.test(r.error.message || "")
        ? "Hubo muchos intentos. Esperá unos minutos y probá de nuevo."
        : "El correo o la contraseña no coinciden.";
      return;
    }
    $("#clave").value = "";
    msg.textContent = "";
  }).catch(function () { b.disabled = false; msg.className = "msg mal"; msg.textContent = "No se pudo conectar. Probá de nuevo."; });
});

$("#b-olvide").addEventListener("click", function () {
  var msg = $("#msg-entrar"), correo = $("#correo").value.trim();
  if (!correo) { msg.className = "msg mal"; msg.textContent = "Escribí tu correo arriba y apretá de nuevo."; return; }
  msg.className = "msg"; msg.textContent = "Mandando…";
  db.auth.signInWithOtp({email: correo, options: {shouldCreateUser: true, emailRedirectTo: location.origin + "/"}}).then(function (r) {
    if (r.error && /rate|seconds|segundos|too many/i.test(r.error.message || "")) {
      msg.className = "msg mal"; msg.textContent = "Ya se mandó uno hace poco. Esperá un minuto y probá de nuevo.";
      return;
    }
    msg.className = "msg bien";
    msg.textContent = "Si ese correo es el tuyo, te llega un mail con un link. Abrilo desde este mismo celu y ahí elegís tu contraseña.";
  }).catch(function () { msg.className = "msg mal"; msg.textContent = "No se pudo conectar. Probá de nuevo."; });
});

/* ── crear la contrasena ─────────────────────────────────────────────────────────────────── */
$("#f-clave").addEventListener("submit", function (ev) {
  ev.preventDefault();
  var msg = $("#msg-clave"), b = $("#b-clave"), c1 = $("#clave1").value, c2 = $("#clave2").value;
  if (c1.length < 10) { msg.className = "msg mal"; msg.textContent = "Tiene que tener al menos 10 caracteres."; return; }
  if (c1 !== c2) { msg.className = "msg mal"; msg.textContent = "Las dos no son iguales."; return; }
  b.disabled = true; msg.className = "msg"; msg.textContent = "Guardando…";
  db.auth.updateUser({password: c1, data: {clave_elegida: true}}).then(function (r) {
    b.disabled = false;
    if (r.error) { msg.className = "msg mal"; msg.textContent = "No se pudo guardar: " + r.error.message; return; }
    $("#clave1").value = ""; $("#clave2").value = "";
    claveElegida = true;
    history.replaceState(null, "", location.pathname);
    mostrar("app");
  }).catch(function () { b.disabled = false; msg.className = "msg mal"; msg.textContent = "No se pudo conectar. Probá de nuevo."; });
});

/* ── sesion ──────────────────────────────────────────────────────────────────────────────── */
function decidir(session) {
  if (!session) {
    mostrar("entrar");
    if (errorDeLink) {
      var m = $("#msg-entrar"); m.className = "msg mal";
      m.textContent = "El link ya no sirve (se vence o se usa una sola vez). Pedí otro con \"Olvidé mi contraseña\".";
      errorDeLink = null;
    }
  } else if (llegoPorLink && !claveElegida) {
    mostrar("clave");
  } else {
    mostrar("app");
  }
}
db.auth.onAuthStateChange(function (evento, session) {
  // sin llamar a la API de adentro del callback (Supabase lo pide): se difiere
  setTimeout(function () {
    if (evento === "SIGNED_OUT") { claveElegida = false; llegoPorLink = false; }
    if (evento === "PASSWORD_RECOVERY") { llegoPorLink = true; }
    decidir(session);
  }, 0);
});
db.auth.getSession().then(function (r) { if (pantalla === null) decidir(r.data && r.data.session); });

$("#b-salir").addEventListener("click", function () { db.auth.signOut(); });

/* ── la app: datos ───────────────────────────────────────────────────────────────────────── */
var timerRefresco = null, timerReloj = null;
var estado = {tablero: null, textos: null};
var fotos = {};
var fotosPedidas = false;
var editando = null;
var vueltas = {};
var ultimoError = null;

function abrirApp() {
  prepararVista();
  refrescar();
  if (!timerRefresco) timerRefresco = setInterval(function () { if (!document.hidden) refrescar(); }, REFRESCO_MS);
  if (!timerReloj) timerReloj = setInterval(pintarReloj, 1000);
}
function prepararVista() {
  $("#t-tablero").classList.toggle("activa", vista === "tablero");
  $("#t-textos").classList.toggle("activa", vista === "textos");
  $("#v-tablero").hidden = (vista !== "tablero");
  $("#v-textos").hidden = (vista !== "textos");
  $("#h-titulo").textContent = vista === "tablero" ? "Tablero de cuentas" : "Textos de cada cuenta";
}
function cerrarApp() {
  clearInterval(timerRefresco); clearInterval(timerReloj); timerRefresco = timerReloj = null;
  estado = {tablero: null, textos: null}; fotos = {}; fotosPedidas = false; editando = null;
  $("#grilla").replaceChildren(); $("#t-cuentas").replaceChildren(); $("#franja").replaceChildren();
}
document.addEventListener("visibilitychange", function () { if (!document.hidden && pantalla === "app") refrescar(); });

function cambiarVista(v) {
  vista = v; guardarLocal("panel-vista", v);
  document.body.className = claseVista();
  prepararVista();
  pintar();
  refrescar();
}
$("#t-tablero").addEventListener("click", function () { cambiarVista("tablero"); });
$("#t-textos").addEventListener("click", function () { cambiarVista("textos"); });

function hayTextoSinGuardar() {
  if (vista !== "textos") return false;
  var f = document.activeElement;
  return !!$("#t-cuentas textarea.cambio") || !!(f && f.tagName === "TEXTAREA");
}

function refrescar() {
  return db.from("estado").select("recurso,datos,actualizado").then(function (r) {
    if (r.error) throw r.error;
    (r.data || []).forEach(function (f) { estado[f.recurso] = {datos: f.datos, actualizado: f.actualizado}; });
    ultimoError = null;
    pintar();
    if (!fotosPedidas) cargarFotos();
  }).catch(function (e) {
    ultimoError = (e && e.message) || "error";
    if (/JWT|expired|invalid/i.test(ultimoError)) { db.auth.signOut(); return; }
    pintarReloj();
  });
}

function cargarFotos() {
  fotosPedidas = true;
  db.from("fotos").select("usuario,mime,b64").then(function (r) {
    if (r.error) { fotosPedidas = false; return; }
    (r.data || []).forEach(function (f) { fotos[f.usuario] = "data:image/jpeg;base64," + f.b64; });
    if (vista === "tablero" && !editando) pintarTablero();
  });
}

function pintar() {
  if (vista === "tablero") { if (!editando) pintarTablero(); } else if (!hayTextoSinGuardar()) { pintarTextos(); }
  pintarReloj();
}

function pintarReloj() {
  var s = $("#sub"), fila = estado[vista];
  if (!fila) { s.className = "sub" + (ultimoError ? " mal" : ""); s.textContent = ultimoError ? "No se pudo leer. Reintentando…" : "Cargando…"; return; }
  var seg = Math.max(0, (Date.now() - new Date(fila.actualizado).getTime()) / 1000);
  if (seg > 180) {
    s.className = "sub mal";
    s.textContent = "El servidor no manda datos " + hace(seg) + ". Lo que ves puede estar viejo.";
  } else {
    s.className = "sub";
    s.textContent = "Actualizado " + hace(seg) + (ultimoError ? " · sin conexión, reintentando" : "");
  }
}

/* ── mandar una accion y esperar el resultado ────────────────────────────────────────────── */
function mandarAccion(tipo, cuenta, payload) {
  return db.from("acciones").insert({tipo: tipo, cuenta: cuenta, payload: payload}).select("id").single().then(function (r) {
    if (r.error) throw new Error("no se pudo mandar: " + r.error.message);
    return esperarAccion(r.data.id, Date.now());
  });
}
function esperarAccion(id, desde) {
  return new Promise(function (resolve, reject) {
    (function mirar() {
      db.from("acciones").select("estado,resultado").eq("id", id).single().then(function (r) {
        if (r.error) return reject(new Error("no se pudo ver el resultado"));
        var e = r.data.estado;
        if (e === "hecha") return resolve(r.data.resultado || {});
        if (e === "error" || e === "rechazada") {
          var m = r.data.resultado && (r.data.resultado.motivo || r.data.resultado.texto);
          return reject(new Error(m || "no se pudo aplicar"));
        }
        if (Date.now() - desde > 120000) return reject(new Error("el servidor tardó demasiado; mirá en un rato si quedó hecho"));
        setTimeout(mirar, 2000);
      });
    })();
  });
}

/* ── vista: tablero ──────────────────────────────────────────────────────────────────────── */
function franja(d) {
  var t = d.totales || {};
  var st = (d.setters || []).map(function (s) {
    return '<div class="st"><i class="punto ' + (s.vivo ? "p-verde" : "p-rojo") + '"></i><b>' + esc(s.nombre) + "</b><span>" +
      (s.vivo ? "vivo" : "CAÍDO") + " · " + hace(s.ultimo_mov_seg) + "</span></div>";
  }).join("");
  $("#franja").innerHTML =
    '<div class="dato setters">' + (st || "<span>Sin setters</span>") + "</div>" +
    '<div class="dato"><b>' + num(t.abridores) + "</b><span>abridores hoy</span></div>" +
    '<div class="dato"><b>' + num(t.contestan_pct, " %") + "</b><span>contestaron</span></div>" +
    '<div class="dato"><b>' + num(t.agendas) + "</b><span>agendas hoy</span></div>" +
    '<div class="dato ' + (t.sin_contestar ? "alerta" : "") + '"><b>' + num(t.sin_contestar) + "</b><span>esperan respuesta del setter</span></div>" +
    '<div class="dato ' + (t.te_necesitan ? "alerta" : "") + '"><b>' + num(t.te_necesitan) + "</b><span>cuentas te necesitan</span></div>";
}

function caja(c) {
  if (!c) return '<div class="caja vacia"><div class="giro"><div class="cara">Lugar libre para otra cuenta</div></div></div>';
  var ini = (c.usuario || "?").replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase();
  var f = fotos[c.usuario];
  var foto = f ? "style=\"background-image:url('" + esc(f) + "')\"" : "";
  var pct = c.tope ? Math.min(100, Math.round(100 * (c.abridores || 0) / c.tope)) : 0;
  var ed = editando === c.usuario;
  return '<div class="caja ' + (vueltas[c.usuario] ? "vuelta" : "") + '" data-u="' + esc(c.usuario) + '"><div class="giro">' +
    '<div class="cara">' +
      '<div class="cab"><div class="foto" ' + foto + ">" + (f ? "" : ini) + '<i class="punto p-' + esc(c.color) + '"></i></div>' +
        '<div class="nom"><b>' + esc(c.nombre || c.usuario) + "</b><span>@" + esc(c.usuario) + "</span></div>" +
        '<div class="setter">' + esc(c.setter || "—") + "</div></div>" +
      '<div class="estado e-' + esc(c.color) + '"><i class="punto p-' + esc(c.color) + '"></i>' + esc(c.estado_texto) + "</div>" +
      '<div class="tope"><div><span>Tope del día</span><span><b>' + num(c.abridores) + "</b> de " + num(c.tope) + '</span></div><div class="barra"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="nums">' +
        '<div class="n"><b>' + num(c.contestan_pct, " %") + "</b><span>contestan</span></div>" +
        '<div class="n"><b>' + num(c.agendas) + "</b><span>agendas</span></div>" +
        '<div class="n ' + (c.no_llegaron ? "mal" : "") + '"><b>' + num(c.no_llegaron) + "</b><span>no llegaron</span></div>" +
      "</div>" +
      '<div class="lineas">' +
        "<div><span>Por abridor</span><b>" + num(c.seg_por_abridor, " s") + "</b></div>" +
        "<div><span>Último envío</span><b>" + hace(c.ultimo_envio_seg) + "</b></div>" +
        '<div><span>Esperan respuesta</span><b class="' + (c.sin_contestar ? "mal" : "") + '">' + num(c.sin_contestar) + "</b></div>" +
        '<div><span>Restricciones en 7 días</span><b class="' + (c.restricciones_7d >= 2 ? "mal" : "") + '">' + num(c.restricciones_7d) + "</b></div>" +
      "</div>" +
      '<div class="vuelta-txt">tocá para ver contacto</div>' +
    "</div>" +
    '<div class="cara atras">' +
      '<div class="cab"><div class="nom"><b>@' + esc(c.usuario) + "</b><span>" + esc(c.setter || "") + "</span></div></div>" +
      '<div class="titulo-det">Contacto</div>' +
      (ed ? '<input class="ed" id="ed-correo" placeholder="correo" maxlength="120" value="' + esc(c.correo) + '">' +
            '<input class="ed" id="ed-tel" placeholder="teléfono" maxlength="120" value="' + esc(c.telefono) + '">' +
            '<span class="editar" data-guardar="' + esc(c.usuario) + '">guardar</span> <span class="editar" data-cancelar="1">cancelar</span>' +
            '<div class="msg" id="msg-contacto"></div>'
          : '<div class="fila"><span>Correo</span><b class="' + (c.correo ? "" : "falta") + '">' + esc(c.correo || "sin correo") + "</b></div>" +
            '<div class="fila"><span>Teléfono</span><b class="' + (c.telefono ? "" : "falta") + '">' + esc(c.telefono || "sin teléfono") + "</b></div>" +
            '<span class="editar" data-editar="' + esc(c.usuario) + '">editar contacto</span>') +
      '<div class="titulo-det">Salud</div>' +
      '<div class="fila"><span>Última restricción</span><b>' + (c.ultima_restriccion_seg == null ? "ninguna" : hace(c.ultima_restriccion_seg)) + "</b></div>" +
      '<div class="fila"><span>Seguidores</span><b>' + num(c.seguidores) + "</b></div>" +
      '<div class="fila"><span>Notas de voz hoy</span><b>' + num(c.notas) + " de " + num(c.abridores) + "</b></div>" +
      '<div class="fila"><span>Seguimientos hoy</span><b>' + num(c.seguimientos) + "</b></div>" +
      '<div class="fila"><span>Red</span><b>' + esc(c.red || "—") + "</b></div>" +
      (c.que_hacer ? '<div class="titulo-det">Qué hacer</div><div class="hacer">' + esc(c.que_hacer) + "</div>" : "") +
      '<div class="vuelta-txt" style="margin-top:auto">tocá para volver</div>' +
    "</div></div></div>";
}

function pintarTablero() {
  var fila = estado.tablero;
  if (!fila) return;
  var d = fila.datos || {};
  franja(d);
  var cs = (d.cuentas || []).slice(0, 8);
  while (cs.length < 8) cs.push(null);
  $("#grilla").innerHTML = cs.map(caja).join("");
}

document.addEventListener("click", function (e) {
  if (pantalla !== "app" || vista !== "tablero") return;
  var t = e.target, ed = t.dataset && t.dataset.editar, gu = t.dataset && t.dataset.guardar;
  if (ed) { editando = ed; pintarTablero(); e.stopPropagation(); return; }
  if (t.dataset && t.dataset.cancelar) { editando = null; pintarTablero(); e.stopPropagation(); return; }
  if (gu) {
    var msg = $("#msg-contacto");
    msg.className = "msg"; msg.textContent = "Guardando… (tarda unos segundos)";
    mandarAccion("contacto", gu, {correo: $("#ed-correo").value.trim(), telefono: $("#ed-tel").value.trim()}).then(function () {
      editando = null;
      return refrescar();
    }).catch(function (err) {
      var m = $("#msg-contacto"); if (m) { m.className = "msg mal"; m.textContent = err.message; }
    });
    e.stopPropagation(); return;
  }
  if (t.closest("input") || editando) return;
  var c = t.closest(".caja[data-u]");
  if (!c) return;
  var u = c.dataset.u;
  if (vueltas[u]) delete vueltas[u]; else vueltas[u] = true;
  c.classList.toggle("vuelta");
});

/* ── vista: textos ───────────────────────────────────────────────────────────────────────── */
function edicionesDe(cuenta) {
  var out = {};
  document.querySelectorAll("#t-cuentas textarea").forEach(function (t) {
    if (t.dataset.cuenta !== cuenta) return;
    if (t.value.trim() === t.dataset.original.trim()) return;
    var c = t.dataset.clave;
    (out[c] = out[c] || {})[t.dataset.idx] = t.value.trim();
  });
  return out;
}

function mostrarRechazos(nodo, rech) {
  var partes = [];
  Object.keys(rech || {}).forEach(function (k) {
    var v = rech[k];
    if (v && typeof v === "object") Object.keys(v).forEach(function (k2) { partes.push(k2 + ": " + v[k2]); });
    else partes.push(k + ": " + v);
  });
  nodo.className = "msg mal";
  nodo.textContent = "No se aprobó, hay que corregir: " + partes.join(" | ");
}

function pintarTextosEstado(d) {
  var cajas = [];
  if (d.pausa) {
    cajas.push(el("div", {clase: "aviso pausa", texto: "Los seguimientos están frenados. Se sueltan solos cuando apruebes el primer lote de las " + (d.rotacion || []).length + " cuentas de la rotación (" + (d.rotacion || []).join(", ") + "). Después salen despacio: como mucho " + d.tope.hora + " por hora y " + d.tope.dia + " por día en cada cuenta."}));
  } else {
    cajas.push(el("div", {clase: "aviso ok", texto: "Los seguimientos están saliendo, con tope de " + d.tope.hora + " por hora y " + d.tope.dia + " por día en cada cuenta."}));
  }
  if (d.lote && d.lote.numero) {
    cajas.push(el("div", {clase: "sub", texto: "Lote " + d.lote.numero + ", armado el " + String(d.lote.generado || "").replace("T", " ").slice(0, 16) + " (UTC)."}));
  } else {
    cajas.push(el("div", {clase: "sub", texto: "Todavía no se armó ningún lote."}));
  }
  var cont = $("#t-estado");
  cont.replaceChildren.apply(cont, cajas);
}

function cuentaTextos(c) {
  var pendiente = c.estado === "pendiente";
  var clasePunto = pendiente ? "p-amarillo" : (c.estado === "al dia" ? "p-verde" : "p-apagado");
  var etiqueta = pendiente ? "esperando tu OK" : (c.estado === "al dia" ? "con textos propios" : "todavía sin textos propios");
  var a = c.acumulados;
  var nums = el("div", {clase: "nums"}, [
    el("span", {clase: "pil", texto: "seguimientos de texto esperando: " + a.texto}),
    el("span", {clase: "pil", texto: "audio o meme esperando: " + a.audio_meme}),
    el("span", {clase: "pil", texto: "para reintentar: " + a.reintentar}),
    el("span", {clase: "pil", texto: "programados a futuro: " + a.futuros}),
    el("span", {clase: "pil", texto: "salieron: " + c.salieron.hora + " en la última hora, " + c.salieron.dia + " hoy"})
  ]);
  var cab = el("div", {clase: "cab"}, [
    el("div", {}, [
      el("h2", {texto: "@" + c.cuenta}),
      el("div", {clase: "meta", texto: (c.rol === "rotacion" ? "rotación" : "reserva") + (c.aprobado ? " · aprobado el " + c.aprobado.replace("T", " ").slice(0, 16) + " (UTC)" : "")})
    ]),
    el("span", {clase: "pil"}, [el("i", {clase: "punto " + clasePunto}), el("span", {texto: etiqueta})])
  ]);
  var seccion = el("div", {clase: "cuenta"}, [cab, nums]);
  var msg = el("div", {clase: "msg"});

  if (pendiente) {
    var guardar = el("button", {type: "button", texto: "Guardar mis cambios"});
    var aprobar = el("button", {type: "button", clase: "principal", texto: "OK a @" + c.cuenta});
    guardar.addEventListener("click", function () {
      guardar.disabled = aprobar.disabled = true; msg.className = "msg"; msg.textContent = "Guardando… (tarda unos segundos)";
      mandarAccion("textos_guardar", c.cuenta, {ediciones: edicionesDe(c.cuenta)}).then(function (r) {
        if (Object.keys(r.rechazados || {}).length) mostrarRechazos(msg, r.rechazados);
        else { msg.className = "msg bien"; msg.textContent = "Cambios guardados."; marcarGuardados(c.cuenta); }
      }).catch(function (e) { msg.className = "msg mal"; msg.textContent = e.message; })
        .then(function () { guardar.disabled = aprobar.disabled = false; });
    });
    aprobar.addEventListener("click", function () {
      guardar.disabled = aprobar.disabled = true; msg.className = "msg"; msg.textContent = "Aprobando… (tarda unos segundos)";
      mandarAccion("textos_aprobar", c.cuenta, {ediciones: edicionesDe(c.cuenta)}).then(function (r) {
        if (r.aprobadas && r.aprobadas.length) { marcarGuardados(c.cuenta); return refrescar(); }
        mostrarRechazos(msg, r.rechazados);
      }).catch(function (e) { msg.className = "msg mal"; msg.textContent = e.message; })
        .then(function () { guardar.disabled = aprobar.disabled = false; });
    });
    seccion.appendChild(el("div", {clase: "acciones"}, [aprobar, guardar]));
    seccion.appendChild(msg);
  }

  c.grupos.forEach(function (g, gi) {
    var cuerpo = el("tbody");
    g.filas.forEach(function (f) {
      var fila = el("tr", {}, [
        el("td", {clase: "num", texto: String(f.i + 1)}),
        el("td", {clase: "actual", texto: f.actual})
      ]);
      var celda = el("td");
      if (pendiente) {
        var t = el("textarea", {rows: "2", maxlength: "800", "data-cuenta": c.cuenta, "data-clave": g.clave, "data-idx": String(f.i)});
        t.value = f.nuevo || "";
        t.dataset.original = f.nuevo || "";
        t.placeholder = "sin texto nuevo: sigue saliendo el de ahora";
        t.addEventListener("input", function () { t.classList.toggle("cambio", t.value.trim() !== t.dataset.original.trim()); });
        celda.appendChild(t);
      } else {
        celda.appendChild(el("span", {clase: "sinnuevo", texto: "nada nuevo pendiente"}));
      }
      fila.appendChild(celda);
      cuerpo.appendChild(fila);
    });
    var tabla = el("table", {}, [
      el("thead", {}, [el("tr", {}, [el("th", {texto: "#"}), el("th", {texto: "Ahora"}), el("th", {texto: "Nuevo"})])]),
      cuerpo
    ]);
    var det = el("details", {}, [
      el("summary", {}, [el("span", {texto: g.titulo}), el("small", {texto: g.filas.length + (g.filas.length === 1 ? " texto" : " textos")})]),
      tabla
    ]);
    if (pendiente && gi < 2) det.setAttribute("open", "");
    seccion.appendChild(det);
  });
  return seccion;
}

/* lo ya mandado deja de contar como "cambio sin guardar": asi el refresco puede volver a pintar */
function marcarGuardados(cuenta) {
  document.querySelectorAll("#t-cuentas textarea").forEach(function (t) {
    if (t.dataset.cuenta === cuenta) { t.dataset.original = t.value; t.classList.remove("cambio"); }
  });
}

function pintarTextos() {
  var fila = estado.textos;
  if (!fila) return;
  var d = fila.datos || {};
  pintarTextosEstado(d);
  var cont = $("#t-cuentas");
  cont.replaceChildren.apply(cont, (d.cuentas || []).map(cuentaTextos));
  $("#ok-todas").disabled = !(d.cuentas || []).some(function (c) { return c.estado === "pendiente"; });
}

$("#ok-todas").addEventListener("click", function () {
  var b = this, msg = $("#msg-global"), d = (estado.textos || {}).datos;
  if (!d) return;
  var por = {};
  d.cuentas.forEach(function (c) { if (c.estado === "pendiente") por[c.cuenta] = edicionesDe(c.cuenta); });
  b.disabled = true; msg.className = "msg"; msg.textContent = "Aprobando… (tarda unos segundos)";
  mandarAccion("textos_aprobar", "todas", {ediciones: por}).then(function (r) {
    if (Object.keys(r.rechazados || {}).length) mostrarRechazos(msg, r.rechazados);
    else { msg.className = "msg bien"; msg.textContent = "Aprobadas: " + (r.aprobadas || []).join(", "); }
    d.cuentas.forEach(function (c) { marcarGuardados(c.cuenta); });
    return refrescar();
  }).catch(function (e) { msg.className = "msg mal"; msg.textContent = e.message; b.disabled = false; });
});
