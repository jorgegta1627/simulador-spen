let reactivos = [];
let seleccionadas = [];

// Proporciones y cantidades oficiales
const proporciones = { A: 0.4, B: 0.2, C: 0.2, D: 0.2 };
const preguntasPorModulo = { A: 60, B: 30, C: 30, D: 30 };

// Mostrar u ocultar opciones según tipo
document.querySelectorAll('input[name="tipoExamen"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const tipo = e.target.value;
    document.getElementById('numPreguntasDiv').style.display = tipo === 'completo' ? 'block' : 'none';
    document.getElementById('seleccionModulo').style.display = tipo === 'modulo' ? 'block' : 'none';
  });
});

// Cargar reactivos automáticamente
fetch("reactivos.json")
  .then(res => {
    if (!res.ok) throw new Error("No encontrado");
    return res.json();
  })
  .then(data => {
    reactivos = data.map(r => {
      const letra = (r.answer || "").toString().trim().toUpperCase();
      const indice = letra === "A" ? 0 : letra === "B" ? 1 : letra === "C" ? 2 : letra === "D" ? 3 : Number(r.answer) || 0;
      return { ...r, answer: indice };
    });
    document.getElementById('jsonStatus').textContent = `✅ ${reactivos.length} reactivos cargados`;
  })
  .catch(() => console.warn("⚠️ No se encontró reactivos.json"));

// Convertir Excel → JSON
document.getElementById('convertirJsonBtn').addEventListener('click', async () => {
  const input = document.getElementById('excelToJsonInput');
  const status = document.getElementById('jsonStatus');

  if (!input.files.length) {
    status.textContent = '❌ Selecciona un archivo Excel primero';
    return;
  }

  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = async function (event) {
    try {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const reactivosConvertidos = jsonData.map((r, i) => {
        const limpiar = (t) => (t ? String(t).replace(/\s+/g, " ").trim() : "");
        const letra = (r["Respuesta Correcta"] || "").toString().trim().toUpperCase();
        const indice = letra === "A" ? 0 : letra === "B" ? 1 : letra === "C" ? 2 : letra === "D" ? 3 : 0;

        return {
          id: r["ID"] || `EXCEL-${Date.now()}-${i}`,
          module: r["Módulo"] || "",
          subarea: limpiar(r["Subárea"]),
          topic: limpiar(r["Tema"]),
          stem: limpiar(r["Pregunta (stem)"]),
          options: [limpiar(r["A"]), limpiar(r["B"]), limpiar(r["C"]), limpiar(r["D"])],
          answer: indice,
          justification: limpiar(r["Justificación"]),
          reference: limpiar(r["Referencia"])
        };
      });

      const fileHandle = await window.showSaveFilePicker({
        suggestedName: "reactivos.json",
        types: [{ description: "Archivo JSON", accept: { "application/json": [".json"] } }]
      });

      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(reactivosConvertidos, null, 2));
      await writable.close();

      reactivos = reactivosConvertidos;
      status.textContent = `✅ ${reactivos.length} reactivos convertidos y guardados correctamente.`;
    } catch (e) {
      console.error(e);
      status.textContent = '❌ Error al convertir o guardar';
    }
  };

  reader.readAsArrayBuffer(file);
});

// Generar examen
document.getElementById('generarBtn').addEventListener('click', () => {
  const tipo = document.querySelector('input[name="tipoExamen"]:checked').value;
  const numPreguntas = parseInt(document.getElementById('numPreguntas').value);
  const examenDiv = document.getElementById('examen');
  const resultadoDiv = document.getElementById('resultado');
  const calificarBtn = document.getElementById('calificarBtn');
  const finalizarBtn = document.getElementById('finalizarBtn');

  examenDiv.innerHTML = '';
  resultadoDiv.innerHTML = '';
  seleccionadas = [];

  if (!reactivos.length) return alert('❌ No hay reactivos cargados.');

  const reactivosPorModulo = { A: [], B: [], C: [], D: [] };
  reactivos.forEach(r => {
    if (reactivosPorModulo[r.module]) reactivosPorModulo[r.module].push(r);
  });

  let todas = [];
  let resumen = "";

  if (tipo === "completo") {
    const seleccionadasPorModulo = {};
    for (let m in proporciones) {
      let cantidad = Math.round(numPreguntas * proporciones[m]);
      const disponibles = reactivosPorModulo[m] || [];
      const barajadas = disponibles.sort(() => 0.5 - Math.random()).slice(0, cantidad);
      todas = todas.concat(barajadas);
      seleccionadasPorModulo[m] = barajadas.length;
    }

    resumen = Object.entries(seleccionadasPorModulo)
      .map(([m, c]) => `<li>Módulo ${m}: ${c} preguntas</li>`).join('');
  } else {
    const mod = document.querySelector('input[name="moduloSeleccionado"]:checked').value;
    const disponibles = reactivosPorModulo[mod] || [];
    const cantidad = preguntasPorModulo[mod];
    todas = disponibles.sort(() => 0.5 - Math.random()).slice(0, cantidad);
    resumen = `<li>Módulo ${mod}: ${todas.length} preguntas</li>`;
  }

  todas = todas.sort(() => 0.5 - Math.random());
  seleccionadas = todas;

  examenDiv.innerHTML = `<h3>Distribución:</h3><ul>${resumen}</ul>`;

  todas.forEach((r, i) => {
    const div = document.createElement('div');
    div.classList.add('reactivo');

    let html = `<p><strong>[Módulo ${r.module}]</strong> ${r.subarea} — <em>${r.topic}</em></p>`;
    html += `<p>${i + 1}. ${r.stem}</p>`;
    html += r.options.map((op, j) =>
      op && op.trim()
        ? `<label><input type="radio" name="pregunta-${i}" value="${j}"> ${String.fromCharCode(65 + j)}. ${op}</label><br>`
        : ''
    ).join('');

    div.innerHTML = html;
    examenDiv.appendChild(div);
  });

  calificarBtn.style.display = 'inline-block';
  finalizarBtn.style.display = 'inline-block';
});

// Calificar examen
document.getElementById('calificarBtn').addEventListener('click', () => {
  const resultadoDiv = document.getElementById('resultado');
  const contenedores = document.querySelectorAll('.reactivo');
  let correctas = 0;

  contenedores.forEach((cont, i) => {
    const seleccion = cont.querySelector(`input[name="pregunta-${i}"]:checked`);
    const reactivo = seleccionadas[i];
    if (seleccion && parseInt(seleccion.value) === reactivo.answer) {
      correctas++;
      cont.style.borderLeft = '5px solid green';
    } else {
      cont.style.borderLeft = '5px solid red';
      const just = document.createElement('div');
      just.classList.add('justificacion');
      just.innerHTML = `
        <strong>❌ Incorrecto.</strong><br>
        Respuesta correcta: <strong>${String.fromCharCode(65 + reactivo.answer)}</strong><br>
        ${reactivo.justification}<br><em>${reactivo.reference}</em>`;
      cont.appendChild(just);
    }
  });

  resultadoDiv.innerHTML = `<h3>Obtuviste ${correctas} de ${seleccionadas.length} correctas (${Math.round((correctas / seleccionadas.length) * 100)}%).</h3>`;
});

// Finalizar examen
document.getElementById('finalizarBtn').addEventListener('click', () => {
  document.getElementById('examen').innerHTML = '';
  document.getElementById('resultado').innerHTML = '';
  document.getElementById('calificarBtn').style.display = 'none';
  document.getElementById('finalizarBtn').style.display = 'none';
  seleccionadas = [];
});

// 🔹 Limpiar solo la pantalla (sin borrar reactivos cargados)
document.getElementById('limpiarPantallaBtn').addEventListener('click', () => {
  document.getElementById('examen').innerHTML = '';
  document.getElementById('resultado').innerHTML = '';
  document.getElementById('calificarBtn').style.display = 'none';
  document.getElementById('finalizarBtn').style.display = 'none';
  seleccionadas = [];
});
