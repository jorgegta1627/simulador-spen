let reactivos = [];
let seleccionadas = [];

const proporciones = {
  A: 0.40,
  B: 0.20,
  C: 0.20,
  D: 0.20,
};

// Convertir archivo Excel a JSON y guardar en memoria
document.getElementById('convertirJsonBtn').addEventListener('click', () => {
  const input = document.getElementById('excelToJsonInput');
  const file = input.files[0];
  const status = document.getElementById('jsonStatus');

  if (!file) {
    status.innerHTML = `<span style="color: red;">❌ No se seleccionó ningún archivo.</span>`;
    return;
  }

  const reader = new FileReader();

  reader.onload = function (event) {
    const data = new Uint8Array(event.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const nuevos = jsonData.map(r => ({
      id: r.id,
      module: r.module,
      subarea: r.subarea,
      topic: r.topic,
      stem: r.pregunta || r.stem || '',
      options: [r.A, r.B, r.C, r.D],
      answer: parseInt(r.respuesta || r.answer),
      justification: r.justificacion || r.justification || '',
      reference: r.referencia || r.reference || ''
    }));

    reactivos = nuevos;

    const blob = new Blob([JSON.stringify(reactivos, null, 2)], { type: "application/json" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "reactivos.json";
    link.click();

    status.innerHTML = `<span style="color: green;">✅ Se convirtió, descargó y cargó en memoria correctamente el archivo JSON.</span>`;
  };

  reader.readAsArrayBuffer(file);
});

// Generar examen
document.getElementById('generarBtn').addEventListener('click', () => {
  const numPreguntas = parseInt(document.getElementById('numPreguntas').value);

  if (reactivos.length === 0) {
    alert('❌ No hay reactivos cargados. Convierte un archivo Excel primero.');
    return;
  }

  const examenDiv = document.getElementById('examen');
  const finalizarBtn = document.getElementById('finalizarBtn');
  const resultadoDiv = document.getElementById('resultado');

  examenDiv.innerHTML = '';
  resultadoDiv.innerHTML = '';
  seleccionadas = [];

  const reactivosPorModulo = { A: [], B: [], C: [], D: [] };
  reactivos.forEach(r => {
    if (reactivosPorModulo[r.module]) {
      reactivosPorModulo[r.module].push(r);
    }
  });

  const seleccionadasPorModulo = {};
  let total = 0;
  for (let modulo in proporciones) {
    let cantidad = Math.round(numPreguntas * proporciones[modulo]);
    seleccionadasPorModulo[modulo] = cantidad;
    total += cantidad;
  }

  if (total !== numPreguntas) {
    let diferencia = numPreguntas - total;
    const orden = Object.keys(proporciones).sort((a, b) => proporciones[b] - proporciones[a]);
    for (let i = 0; diferencia !== 0 && i < orden.length; i++) {
      const m = orden[i];
      seleccionadasPorModulo[m] += diferencia > 0 ? 1 : -1;
      diferencia += diferencia > 0 ? -1 : 1;
    }
  }

  const resumen = document.createElement('div');
  resumen.innerHTML = `
    <h3>Distribución del examen (${numPreguntas} preguntas):</h3>
    <ul>
      ${Object.entries(seleccionadasPorModulo).map(([modulo, cantidad]) =>
        `<li>Módulo ${modulo}: ${cantidad} preguntas</li>`).join('')}
    </ul>
  `;
  examenDiv.appendChild(resumen);

  let todas = [];
  for (let modulo in seleccionadasPorModulo) {
    const cantidad = seleccionadasPorModulo[modulo];
    const barajadas = reactivosPorModulo[modulo].sort(() => 0.5 - Math.random()).slice(0, cantidad);
    todas = todas.concat(barajadas);
  }

  todas = todas.sort(() => 0.5 - Math.random());
  seleccionadas = todas;

  todas.forEach((reactivo, index) => {
    const contenedor = document.createElement('div');
    contenedor.classList.add('reactivo');

    const etiqueta = document.createElement('p');
    etiqueta.style.fontSize = "0.9em";
    etiqueta.style.color = "#555";
    etiqueta.innerHTML = `<strong>[Módulo ${reactivo.module}]</strong> ${reactivo.subarea} — <em>${reactivo.topic}</em>`;
    contenedor.appendChild(etiqueta);

    const pregunta = document.createElement('p');
    pregunta.textContent = `${index + 1}. ${reactivo.stem}`;
    contenedor.appendChild(pregunta);

    const opcionesDiv = document.createElement('div');
    opcionesDiv.classList.add('opciones');

    reactivo.options.forEach((opcion, i) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `pregunta-${index}`;
      input.value = i;
      label.appendChild(input);
      label.append(` ${String.fromCharCode(65 + i)}. ${opcion}`);
      opcionesDiv.appendChild(label);
    });

    contenedor.appendChild(opcionesDiv);
    examenDiv.appendChild(contenedor);
  });

  finalizarBtn.style.display = 'inline-block';
});

// Finalizar examen
document.getElementById('finalizarBtn').addEventListener('click', () => {
  const resultadoDiv = document.getElementById('resultado');
  const contenedores = document.querySelectorAll('.reactivo');
  let correctas = 0;

  contenedores.forEach((contenedor, index) => {
    const seleccion = contenedor.querySelector(`input[name="pregunta-${index}"]:checked`);
    const reactivo = seleccionadas[index];
    const justificacion = document.createElement('div');
    justificacion.classList.add('justificacion');

    if (seleccion && parseInt(seleccion.value) === reactivo.answer) {
      correctas++;
      justificacion.innerHTML = `<strong>✅ Correcto.</strong><br>${reactivo.justification}<br><em>${reactivo.reference}</em>`;
    } else {
      justificacion.innerHTML = `<strong>❌ Incorrecto.</strong><br>Respuesta correcta: <strong>${String.fromCharCode(65 + reactivo.answer)}</strong><br>${reactivo.justification}<br><em>${reactivo.reference}</em>`;
    }

    contenedor.appendChild(justificacion);
    justificacion.style.display = 'block';
  });

  resultadoDiv.innerHTML = `<h3>Obtuviste ${correctas} de ${seleccionadas.length} correctas (${Math.round((correctas / seleccionadas.length) * 100)}%).</h3>`;
  document.getElementById('finalizarBtn').style.display = 'none';
});
