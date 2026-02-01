# 🚀 DEPLOYMENT CHECKLIST - Beta Access System

## Pre-Deployment (Antes de ir a Producción)

### 1. Cambiar Contraseña
```javascript
// Archivo: Frontend/access-gate.js - Línea 3
const BETA_PASSWORD = "TuContraseñaSecreta";  // Cambiar de "NoseKnows"
```

**Recomendación:** Usa una contraseña más única para producción

### 2. Verificar Límite de Generaciones
```javascript
// Archivo: Frontend/access-gate.js - Línea 6
const GENERATION_LIMIT = 10;  // Ajusta si necesitas
```

Consideraciones:
- 10 = acceso moderado a beta
- 20 = acceso generoso
- 50 = casi sin límite

### 3. Revisar Token Expiry (Duración de Acceso)
```javascript
// Archivo: Frontend/access-gate.js - Línea 35
if (now - tokenData.timestamp > 7 * 24 * 60 * 60 * 1000) {  // 7 días
```

Opciones:
- 1 día: Beta cerrada, nuevo acceso cada día
- 7 días: Balance (recomendado)
- 30 días: Acceso largo

---

## Deployment Steps

### ✅ PASO 1: Validar en Local
```bash
# 1. Eliminar token anterior
# DevTools Console:
localStorage.removeItem('beta_access_token')

# 2. Refrescar
# F5

# 3. Verificar que aparece "BETA ACCESS"
# 4. Ingresar contraseña (ahora "NoseKnows")
# 5. Verificar que funciona todo
```

### ✅ PASO 2: Cambiar Contraseña
Editar `Frontend/access-gate.js` línea 3:
```javascript
const BETA_PASSWORD = "TuContraseñaBeta2025";
```

### ✅ PASO 3: Commit & Push
```bash
# Terminal
cd c:\Users\luiso\Desktop\Whats-the-smell

git add Frontend/access-gate.js
git add Frontend/app.js
git add Frontend/index.html
git commit -m "feat: Add beta early access system with rate limiting"
git push origin main
```

### ✅ PASO 4: Deployar a Cloudflare
```bash
# Si usas Cloudflare Workers o Pages
# Los cambios se replicarán automáticamente
# Esperar ~1-2 minutos para propagación global
```

### ✅ PASO 5: Verificar en Producción
1. Abrir: https://whatsthesmell.ai
2. Debe mostrar: "BETA ACCESS"
3. Ingresar contraseña: (la contraseña que estableciste)
4. Debe funcionar todo normalmente

---

## Post-Deployment Validation

### En Navegador (F12 Console)
```javascript
// 1. Verificar que access gate cargó
typeof initAccessGate  // "function"

// 2. Verificar rate limiting
getGenerationLimitInfo()
// { used: 0, remaining: 10, limit: 10, percentage: 0 }

// 3. Verificar token guardado
localStorage.getItem('beta_access_token')
// { "timestamp": ..., "generations": 0 }
```

### Checklist Visual
- ✅ Logo de perro en centro
- ✅ Texto "BETA ACCESS"
- ✅ Campo de contraseña
- ✅ Botón "ACCESS"
- ✅ Animación de aroma al validar
- ✅ Transición suave al sitio
- ✅ Generación de olores funciona
- ✅ Contador incrementa en cada generación

---

## Monitoreo Post-Launch

### Logs a Revisar
```javascript
// Console:
console.log("API Response:", data);          // Generación
console.log("Generation limit:", limitInfo); // Rate limiting
console.log("Token:", token);                // Autenticación
```

### Métricas a Validar
1. **Acceso:** ¿Cuántos usuarios entran diariamente?
2. **Rate:** ¿Cuántas generaciones promedio por usuario?
3. **Errores:** ¿Hay errores de contraseña?
4. **Performance:** ¿Tiene impacto en velocidad?

### Preguntas a Responder (Primera Semana)
- ¿El límite de 10 es apropiado?
- ¿Hay mucho "tráfico" de contraseña incorrecta?
- ¿Usuarios entienden la limitación?
- ¿Necesitas cambiar contraseña?

---

## Troubleshooting en Producción

### Error: "Invalid password. Try again."
**Causa:** Contraseña incorrecta
**Solución:** Verificar que escribió la contraseña correcta

### Error: "Daily limit reached (10/10)"
**Causa:** Alcanzó límite de 10 generaciones
**Solución:** Esperar 24 horas para reset automático

### Pantalla Negra/Blanca
**Causa:** access-gate.js no cargó
**Solución:** Verificar que archivo existe en Frontend/

### No Puedo Acceder (Token Expirado)
**Causa:** Token pasó 7 días
**Solución:** Ingresar contraseña nuevamente

### Rate Limit No Funciona
**Causa:** localStorage está vacío
**Solución:** Limpiar y refrescar:
```javascript
localStorage.clear()
location.reload()
```

---

## Rollback (Si necesitas revertir)

### Opción 1: Remover Sistema Completo
```javascript
// Editar Frontend/index.html
// Eliminar línea: <script src="access-gate.js"></script>
// Remover CSS: main { display: none; }
// Cambiar: window.addEventListener("DOMContentLoaded", initAccessGate);
//         por: window.addEventListener("DOMContentLoaded", boot);
```

### Opción 2: Solo Deshabilitar
```javascript
// En access-gate.js línea 40
// Cambiar: initAccessGate()
//         por: showMainSite()  // Skips auth
```

### Opción 3: Git Revert
```bash
git revert <commit-hash>
git push origin main
```

---

## Actualizar Contraseña Después de Launch

**Escenario:** Alguien filtró la contraseña

```javascript
// access-gate.js línea 3
const BETA_PASSWORD = "NuevaContraseñaSegura";

// Git
git add Frontend/access-gate.js
git commit -m "security: Update beta password"
git push origin main

// Notificar a usuarios beta sobre nueva contraseña
```

### Cuidado
- Los tokens actuales seguirán siendo válidos
- Si necesitas limpiar tokens:
  ```javascript
  // Backend route (agregado):
  app.post("/api/clear-beta-tokens", (req, res) => {
    // Broadcast a todos: localStorage.removeItem('beta_access_token')
  });
  ```

---

## Escalabilidad Futura

### Si necesitas más control:

1. **Mover validación a backend**
   ```javascript
   // Cambiar verificación de localStorage a JWT
   // Implementar database de usuarios beta
   // Agregar logs en servidor
   ```

2. **Agregar analytics**
   ```javascript
   // Trackear en Google Analytics
   // Events: beta_access, generation_count
   ```

3. **Dashboard de admin**
   ```javascript
   // Endpoint: /admin/beta-stats
   // Mostrar: usuarios activos, generaciones, errores
   ```

---

## Final Checklist

Antes de dar por finalizado:

- [ ] Contraseña cambiada a algo único
- [ ] Límite de generaciones revisado
- [ ] Token expiry verificado
- [ ] Archivos commiteados a git
- [ ] Pushed a main branch
- [ ] Cloudflare propagado (~2 min)
- [ ] Validación en producción exitosa
- [ ] Documentación compartida con equipo
- [ ] Usuarios beta notificados
- [ ] Logs siendo monitoreados

---

## Contacto/Soporte

**Si algo falla en producción:**
1. Revisar Browser Console (F12)
2. Verificar que access-gate.js cargó
3. Limpiar localStorage
4. Si persiste: Revertir con git

---

**Estado:** ✅ Sistema Listo para Deployment
**Contraseña Temporal:** `NoseKnows`
**Acción Requerida:** Cambiar contraseña antes de ir a producción

