// Wrap everything in an IIFE to avoid polluting the global scope
(function() {
  // ----- Global Variables & UI Elements -----
  let mode = 'drag'; // "drag" or "force"
  let forceMagnitude = parseFloat(document.getElementById('forceSlider').value);
  let objectMass = parseFloat(document.getElementById('massSlider').value);
  let objectFriction = parseFloat(document.getElementById('frictionSlider').value);
  let gravityValue = parseFloat(document.getElementById('gravitySlider').value);

  // Variables for force mode
  let forceModeActive = false;
  let forceStartPos = null;
  let selectedBody = null;
  let currentMousePos = null;

  // ----- Matter.js Module Aliases -----
  const Engine = Matter.Engine,
        Render = Matter.Render,
        Runner = Matter.Runner,
        Bodies = Matter.Bodies,
        Composite = Matter.Composite,
        Mouse = Matter.Mouse,
        MouseConstraint = Matter.MouseConstraint,
        Events = Matter.Events,
        Query = Matter.Query,
        Vector = Matter.Vector;

  // ----- Create Engine & World -----
  const engine = Engine.create();
  engine.world.gravity.y = gravityValue;

  // Get the simulation container dimensions
  const simulationDiv = document.getElementById('simulation');
  const width = simulationDiv.clientWidth;
  const height = simulationDiv.clientHeight;

  // ----- Create Renderer -----
  const render = Render.create({
    element: simulationDiv,
    engine: engine,
    canvas: document.getElementById('world'),
    options: {
      width: width,
      height: height,
      wireframes: false,
      background: '#fafafa'
    }
  });
  Render.run(render);

  // ----- Create Runner -----
  const runner = Runner.create();
  Runner.run(runner, engine);

  // ----- Add Boundaries -----
  const boundaries = [
    // Top
    Bodies.rectangle(width / 2, -25, width, 50, { isStatic: true }),
    // Bottom
    Bodies.rectangle(width / 2, height + 25, width, 50, { isStatic: true }),
    // Left
    Bodies.rectangle(-25, height / 2, 50, height, { isStatic: true }),
    // Right
    Bodies.rectangle(width + 25, height / 2, 50, height, { isStatic: true })
  ];
  Composite.add(engine.world, boundaries);

  // ----- Add an Initial Ball -----
  const ball = Bodies.circle(width / 2, height / 2, 30, {
    restitution: 0.8,
    friction: objectFriction,
    mass: objectMass,
    render: {
      fillStyle: '#ff6f61'
    }
  });
  Composite.add(engine.world, ball);

  // ----- Add Mouse Constraint for Drag Mode -----
  const mouse = Mouse.create(render.canvas);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.2,
      render: { visible: false }
    }
  });
  Composite.add(engine.world, mouseConstraint);
  render.mouse = mouse;

  // ----- UI Event Listeners -----

  // Change Interaction Mode
  document.getElementById('modeSelect').addEventListener('change', function(e) {
    mode = e.target.value;
    // In force mode, disable the drag constraint; re-enable in drag mode
    if (mode === 'force') {
      mouseConstraint.constraint.enabled = false;
    } else {
      mouseConstraint.constraint.enabled = true;
    }
  });

  // Update Force Magnitude Slider
  document.getElementById('forceSlider').addEventListener('input', function(e) {
    forceMagnitude = parseFloat(e.target.value);
    document.getElementById('forceValue').innerText = forceMagnitude;
  });

  // Update Object Mass Slider
  document.getElementById('massSlider').addEventListener('input', function(e) {
    objectMass = parseFloat(e.target.value);
    document.getElementById('massValue').innerText = objectMass;
  });

  // Update Object Friction Slider
  document.getElementById('frictionSlider').addEventListener('input', function(e) {
    objectFriction = parseFloat(e.target.value);
    document.getElementById('frictionValue').innerText = objectFriction;
  });

  // Update Gravity Slider
  document.getElementById('gravitySlider').addEventListener('input', function(e) {
    gravityValue = parseFloat(e.target.value);
    document.getElementById('gravityValue').innerText = gravityValue;
    engine.world.gravity.y = gravityValue;
  });

  // Spawn a New Ball with current mass and friction
  document.getElementById('spawnButton').addEventListener('click', function() {
    const newBall = Bodies.circle(
      Math.random() * (width - 60) + 30, // random x position (with margin)
      50, // y position near the top
      30,
      {
        restitution: 0.8,
        friction: objectFriction,
        mass: objectMass,
        render: { fillStyle: getRandomColor() }
      }
    );
    Composite.add(engine.world, newBall);
  });

  // Utility: Generate a Random Color
  function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  // ----- Force Mode Mouse Events -----
  // When in force mode, allow the user to click on an object and drag to apply a force.
  render.canvas.addEventListener('mousedown', function() {
    if (mode === 'force') {
      const mousePosition = mouse.position;
      // Find bodies under the mouse position
      const bodies = Composite.allBodies(engine.world);
      const foundBodies = Query.point(bodies, mousePosition);
      if (foundBodies.length > 0) {
        selectedBody = foundBodies[0];
        forceStartPos = { x: mousePosition.x, y: mousePosition.y };
        forceModeActive = true;
      }
    }
  });

  render.canvas.addEventListener('mousemove', function() {
    if (mode === 'force' && forceModeActive) {
      currentMousePos = { x: mouse.position.x, y: mouse.position.y };
    }
  });

  render.canvas.addEventListener('mouseup', function() {
    if (mode === 'force' && forceModeActive && selectedBody) {
      // Compute drag vector (from initial click to release)
      const dragVector = {
        x: forceStartPos.x - mouse.position.x,
        y: forceStartPos.y - mouse.position.y
      };
      // Scale the force vector (the constant 0.001 is an experimental scaling factor)
      const appliedForce = {
        x: dragVector.x * forceMagnitude * 0.001,
        y: dragVector.y * forceMagnitude * 0.001
      };
      // Apply the force at the object's center
      Matter.Body.applyForce(selectedBody, selectedBody.position, appliedForce);
    }
    // Reset force mode variables
    forceModeActive = false;
    forceStartPos = null;
    selectedBody = null;
    currentMousePos = null;
  });

  // ----- Visualization: Draw Velocity and Force Arrows -----
  Events.on(render, 'afterRender', function() {
    const context = render.context;
    context.save();

    // Draw a blue arrow for each dynamic body’s velocity (scaled for visibility)
    const bodies = Composite.allBodies(engine.world);
    bodies.forEach(body => {
      if (!body.isStatic) {
        const pos = body.position;
        const vel = body.velocity;
        const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
        if (speed > 0.5) { // only show if the velocity is significant
          drawArrow(context, pos.x, pos.y, pos.x + vel.x * 10, pos.y + vel.y * 10, 'blue');
        }
      }
    });

    // In force mode, if dragging, draw a red arrow representing the force vector
    if (mode === 'force' && forceModeActive && forceStartPos && currentMousePos) {
      drawArrow(context, forceStartPos.x, forceStartPos.y, currentMousePos.x, currentMousePos.y, 'red');
    }
    context.restore();
  });

  /**
   * Draw an arrow from (fromx, fromy) to (tox, toy) with the given color.
   */
  function drawArrow(context, fromx, fromy, tox, toy, color) {
    const headLength = 10; // length of arrowhead in pixels
    const dx = tox - fromx;
    const dy = toy - fromy;
    const angle = Math.atan2(dy, dx);
    // Draw the main line
    context.beginPath();
    context.moveTo(fromx, fromy);
    context.lineTo(tox, toy);
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.stroke();
    // Draw the arrowhead
    context.beginPath();
    context.moveTo(tox, toy);
    context.lineTo(tox - headLength * Math.cos(angle - Math.PI / 6), toy - headLength * Math.sin(angle - Math.PI / 6));
    context.lineTo(tox - headLength * Math.cos(angle + Math.PI / 6), toy - headLength * Math.sin(angle + Math.PI / 6));
    context.lineTo(tox, toy);
    context.fillStyle = color;
    context.fill();
  }

  // ----- Handle Window Resize -----
  window.addEventListener('resize', function() {
    const width = simulationDiv.clientWidth;
    const height = simulationDiv.clientHeight;
    render.canvas.width = width;
    render.canvas.height = height;
  });
})();
