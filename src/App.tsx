import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import './App.css'

type ShapeTool = 'square' | 'rectangle' | 'circle'

type Mode = 'draw' | 'scale'

function App() {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [tool, setTool] = useState<ShapeTool>('rectangle')
  const [mode, setMode] = useState<Mode>('draw')

  const toolRef = useRef<ShapeTool>('rectangle')//
  const modeRef = useRef<Mode>('draw')
  
  const shapesRef = useRef<{
    type: ShapeTool
    start: THREE.Vector3
    end: THREE.Vector3
    mesh: THREE.Mesh
  }[]>([])
  
  const selectedIndexRef = useRef<number>(-1)
  
  useEffect(() => {
    toolRef.current = tool
  }, [tool])

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    const mount = mountRef.current


    if (!mount) {
      return
    }

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#111111')

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 1000,)
    camera.position.set(0, 0, 22)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    const pointer = new THREE.Vector2()
    const raycaster = new THREE.Raycaster()
    const drawPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const dragStart = new THREE.Vector3()
    const dragCurrent = new THREE.Vector3()
    let isDragging = false
    let previewMesh: THREE.Mesh | null = null

    const getWorldPoint = (event: PointerEvent, target: THREE.Vector3) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      raycaster.ray.intersectPlane(drawPlane, target)
    }

    const disposePreview = () => {
      if (!previewMesh) {
        return
      }
      previewMesh.geometry.dispose()
      ;(previewMesh.material as THREE.Material).dispose()
      scene.remove(previewMesh)
      previewMesh = null
    }

    const createShapeMesh = (
      selectedTool: ShapeTool,
      start: THREE.Vector3,
      end: THREE.Vector3,
      color: string,
      opacity: number,
    ) => {
      const dx = end.x - start.x
      const dy = end.y - start.y
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)

      let geometry: THREE.BufferGeometry
      let centerX = start.x + dx * 0.5
      let centerY = start.y + dy * 0.5

      if (selectedTool === 'circle') {
        const radius = Math.max(0.05, Math.sqrt(dx * dx + dy * dy))
        const shape = new THREE.Shape()
        shape.absarc(0, 0, radius, 0, Math.PI * 2)
        geometry = new THREE.ShapeGeometry(shape, 48)
        centerX = start.x
        centerY = start.y
      } else if (selectedTool === 'square') {
        const side = Math.max(0.05, Math.max(absDx, absDy))
        centerX = start.x + Math.sign(dx || 1) * side * 0.5
        centerY = start.y + Math.sign(dy || 1) * side * 0.5
        geometry = new THREE.PlaneGeometry(side, side)
      } else {
        geometry = new THREE.PlaneGeometry(Math.max(0.05, absDx), Math.max(0.05, absDy))
      }

      const material = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(centerX, centerY, 0)
      return mesh
    }

    const handlePointerDown = (event: PointerEvent) => {
      getWorldPoint(event, dragStart)
      dragCurrent.copy(dragStart)

      if (modeRef.current === 'scale'){
        const rect = renderer.domElement.getBoundingClientRect()
        pointer.x = ((event.clientX - rect.left) / rect.width ) *2 - 1
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
        
        raycaster.setFromCamera(pointer, camera)

        const intersects = raycaster.intersectObjects(
          shapesRef.current.map(s => s.mesh)
        )

        if(intersects.length > 0){
          const clickedMesh = intersects[0].object

          const index = shapesRef.current.findIndex(s => s.mesh === clickedMesh)
          selectedIndexRef.current = index
          isDragging = true
        } else {
          selectedIndexRef.current = -1
          isDragging = false
        }

      return
      }
      isDragging = true
      disposePreview()
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!isDragging) {
        return
      }

      if (modeRef.current === 'scale' && selectedIndexRef.current !== -1) {
        getWorldPoint(event, dragCurrent)
        
        const shape = shapesRef.current[selectedIndexRef.current]

        // update end point
        shape.end = dragCurrent.clone()

        // remove old mesh
        scene.remove(shape.mesh)

        // create new scaled mesh
        const newMesh = createShapeMesh(shape.type, shape.start, shape.end, '#ff0000', 0.9)

        scene.add(newMesh)

        // update stored mesh
        shape.mesh = newMesh

        return
      }

      getWorldPoint(event, dragCurrent)
      disposePreview()
      previewMesh = createShapeMesh(toolRef.current, dragStart, dragCurrent, '#f8f8f8', 0.45)
      scene.add(previewMesh)
    }

    const handlePointerUp = () => {
      if (!isDragging) {
        return
      }
      isDragging = false

      if (modeRef.current === 'scale') {
        selectedIndexRef.current = -1
        return
      }

      if (!previewMesh) {
        return
      }

      const finalMesh = createShapeMesh(toolRef.current, dragStart, dragCurrent, '#ff0000', 0.9)
      scene.add(finalMesh)

      shapesRef.current.push({
        type: toolRef.current,
        start: dragStart.clone(),
        end: dragCurrent.clone(),
        mesh:finalMesh,
      })

      disposePreview()
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!mountRef.current) {
        return
      }
      const width = mountRef.current.clientWidth
      const height = mountRef.current.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    })
    resizeObserver.observe(mount)

    renderer.domElement.addEventListener('pointerdown', handlePointerDown)
    renderer.domElement.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    const animate = () => {
      renderer.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()

    return () => {
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
      renderer.domElement.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      disposePreview()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [])

  return (
  <div className="app">
    <div className="toolbar">
      <button
        className={tool === 'rectangle' ? 'active' : ''}
        onClick={() => {
          setTool('rectangle')
          setMode('draw')
        }}
      >
        Rectangle
      </button>

      <button
        className={tool === 'square' ? 'active' : ''}
        onClick={() => {
          setTool('square')
          setMode('draw')
        }}
      >
        Square
      </button>

      <button
        className={tool === 'circle' ? 'active' : ''}
        onClick={() => {
          setTool('circle')
          setMode('draw')
        }}
      >
        Circle
      </button>

      <button
        className={mode === 'scale' ? 'active' : ''}
        onClick={() => setMode('scale')}
      >
        Scale
      </button>
    </div>

    <div className="hint">
      Click and drag in canvas to draw {tool}.
    </div>

    <div ref={mountRef} className="canvas-wrap" />
  </div>
)
}

export default App
