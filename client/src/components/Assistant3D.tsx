import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useSpring, a, config } from '@react-spring/three';
import { useDrag } from '@use-gesture/react';
import * as THREE from 'three';
import { RoundedBox, Environment, MeshTransmissionMaterial, Html, ContactShadows } from '@react-three/drei';
import type { AssistantState } from '../App';
import { useAssistantStore } from '@/store';
import { useAudioQueueStore } from '@/store/audioQueueStore';
import { Tooltip } from '@/components/Tooltip';
import { setIgnoreMouseEvents } from '@/utils/electronInteraction';

// Helper for UI Sounds
const playBeep = (freq: number, type: OscillatorType, duration: number, vol: number) => {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        // Quick fade out
        gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) { /* ignore if context suspended */ }
};

interface Assistant3DProps {
    state: AssistantState;
}

export const Assistant3D: React.FC<Assistant3DProps> = ({ state }) => {
    const groupRef = useRef<THREE.Group>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const { size, viewport } = useThree();
    const aspect = size.width / viewport.width;

    const targetExpressions = useRef({
        rotX: 0, rotY: 0, rotZ: 0,
        browLY: 0.5, browRY: 0.5, browLRot: 0, browRRot: 0,
        eyeScaleY: 1, eyeScaleX: 1,
        color: '#ffffff'
    });

    const leftEyeRef = useRef<THREE.Mesh>(null);
    const rightEyeRef = useRef<THREE.Mesh>(null);
    const leftBrowRef = useRef<THREE.Mesh>(null);
    const rightBrowRef = useRef<THREE.Mesh>(null);

    const [tooltipVisible, setTooltipVisible] = useState(false);
    const [tooltipText] = useState('Arraste-me! / Duplo clique');

    const getFrequencyData = useAudioQueueStore(state => state.getFrequencyData);
    const isPlayingTTS = useAudioQueueStore(state => state.isPlaying);
    const setPannerPosition = useAudioQueueStore(state => state.setPannerPosition);

    // Dragging logic with react-spring physics
    const [springProps, api] = useSpring(() => ({
        position: [2.5, -2.0, 0],
        scale: [0.8, 0.8, 0.8],
        rotation: [0, 0, 0],
        config: { mass: 2, tension: 500, friction: 40 } // Bouncy spring
    }));

    const bind = useDrag(({ offset: [x, y], down, movement: [, my], tap, velocity }) => {
        // Ignore click/tap, handled elsewhere
        if (tap) return;

        // When dragging, squash and stretch slightly based on velocity
        const stretchY = down ? Math.max(0.5, 0.8 - my * 0.002) : 0.8;
        const stretchX = down ? Math.max(0.5, 0.8 + my * 0.002) : 0.8;

        // Fixed bounds for a standard Electron window (approximate coordinates relative to 0,0 center)
        const boundX = 6;
        const boundY = 6;

        // Clamp coordinates
        const clampedX = Math.max(-boundX, Math.min(boundX, x / aspect));
        const clampedY = Math.max(-boundY, Math.min(boundY, -y / aspect));

        api.start({
            position: [clampedX, clampedY, 0],
            scale: [stretchX, stretchY, 0.8],
            rotation: [velocity[1] * 0.05, velocity[0] * 0.05, 0], // Tilt in direction of drag (inertia/rotation)
            immediate: down,
            config: down ? config.stiff : { mass: 2, tension: 500, friction: 40 } // Snap back bounce
        });

        // Drop / Release physics
        if (!down) {
            // Magnet to edges
            let finalX = clampedX;
            let finalY = clampedY;

            // Snap to left or right if close
            if (clampedX < -boundX + 1.5) finalX = -boundX + 0.5;
            if (clampedX > boundX - 1.5) finalX = boundX - 0.5;
            if (clampedY < -boundY + 1.5) finalY = -boundY + 0.5;

            // Simple gravity floor bounce
            if (clampedY < -boundY + 2.0 && velocity[1] > 1) {
                playBeep(150, 'sine', 0.2, 0.5); // Thud sound
                // Slammed into the floor
                api.start({
                    position: [finalX, -boundY + 0.5, 0],
                    scale: [1.2, 0.4, 0.8], // strong squash
                    config: config.wobbly
                });
                setTimeout(() => {
                    api.start({ scale: [0.8, 0.8, 0.8], config: config.wobbly });
                }, 100);
            } else {
                api.start({
                    position: [finalX, finalY, 0],
                    rotation: [0, 0, 0],
                    config: config.wobbly
                });
            }
        }

    }, {
        from: () => {
            const p = springProps.position.get();
            return [p[0] * aspect, -p[1] * aspect];
        },
        filterTaps: true
    });

    // State machine for assistant expressions
    useEffect(() => {
        const updateExpr = (newExpr: any) => {
            targetExpressions.current = { ...targetExpressions.current, ...newExpr };
        }
        switch (state) {
            case 'WAITING':
                updateExpr({ rotX: 0, rotY: 0, rotZ: 0, browLY: 0.5, browRY: 0.5, browLRot: 0, browRRot: 0, eyeScaleY: 1, eyeScaleX: 1, color: '#ffffff' });
                break;
            case 'LISTENING':
                updateExpr({ rotX: -0.2, rotY: 0.2, rotZ: 0.1, browLY: 0.8, browRY: 0.8, browLRot: 0.1, browRRot: -0.1, eyeScaleY: 1.2, eyeScaleX: 1.2, color: '#4ade80' });
                break;
            case 'THINKING':
                updateExpr({ rotX: 0.1, rotY: -0.2, rotZ: -0.1, browLY: 0.7, browRY: 0.4, browLRot: 0.2, browRRot: -0.2, eyeScaleY: 0.5, eyeScaleX: 0.8, color: '#a855f7' });
                break;
            case 'SPEAKING':
                updateExpr({ rotX: -0.1, rotY: 0, rotZ: 0, browLY: 0.9, browRY: 0.9, browLRot: 0.1, browRRot: -0.1, eyeScaleY: 1.1, eyeScaleX: 1, color: '#3b82f6' });
                break;
            case 'SCARED':
                updateExpr({ rotX: 0.2, rotY: 0, rotZ: 0, browLY: 0.3, browRY: 0.3, browLRot: -0.4, browRRot: 0.4, eyeScaleY: 0.6, eyeScaleX: 0.5, color: '#ef4444' });
                break;
            case 'SLEEPY':
                updateExpr({ rotX: 0, rotY: -0.2, rotZ: 0, browLY: 0.4, browRY: 0.4, browLRot: 0, browRRot: 0, eyeScaleY: 0.1, eyeScaleX: 1, color: '#9ca3af' });
                break;
            case 'CONFUSED':
                updateExpr({ rotX: 0.1, rotY: 0.1, rotZ: 0.1, browLY: 0.8, browRY: 0.3, browLRot: 0.2, browRRot: -0.2, eyeScaleY: 0.9, eyeScaleX: 0.9, color: '#f59e0b' });
                break;
            case 'HAPPY':
                updateExpr({ rotX: -0.1, rotY: 0, rotZ: 0, browLY: 0.7, browRY: 0.7, browLRot: 0.1, browRRot: -0.1, eyeScaleY: 1.1, eyeScaleX: 1.1, color: '#fbcfe8' });
                break;
        }
    }, [state]);

    // Idle animation (floating and occasional blinks/jumps)
    const lastMousePos = useRef(new THREE.Vector2());
    const dodgeVelocity = useRef(new THREE.Vector3());

    useFrame(({ clock, mouse }) => {
        if (!groupRef.current) return;
        const time = clock.getElapsedTime();

        // Cursor Dodging Logic (Scared State)
        const mouseDeltaX = mouse.x - lastMousePos.current.x;
        const mouseDeltaY = mouse.y - lastMousePos.current.y;
        const mouseSpeed = Math.sqrt(mouseDeltaX * mouseDeltaX + mouseDeltaY * mouseDeltaY);

        lastMousePos.current.set(mouse.x, mouse.y); // update last pos

        // State Machine Override Logic
        if (mouseSpeed > 0.1 && state === 'WAITING') {
            // Very fast mouse movement -> dodge (Scared)
            dodgeVelocity.current.set(Math.sign(mouseDeltaX) * -1, Math.sign(mouseDeltaY) * 1, 0);
            targetExpressions.current = { ...targetExpressions.current, color: '#ef4444', eyeScaleY: 0.5, eyeScaleX: 0.6, browLY: 0.3, browRY: 0.3, browLRot: -0.4, browRRot: 0.4 };

            // Recover after a bit
            setTimeout(() => {
                const currentState = useAssistantStore.getState().state;
                if (currentState === 'WAITING') {
                    targetExpressions.current = { ...targetExpressions.current, color: '#ffffff', eyeScaleY: 1, eyeScaleX: 1, browLY: 0.5, browRY: 0.5, browLRot: 0, browRRot: 0 };
                }
            }, 1000);
        } else if (mouseSpeed > 0.01 && mouseSpeed < 0.05 && state === 'WAITING') {
            targetExpressions.current = { ...targetExpressions.current, color: '#fbcfe8', eyeScaleY: 0.8, eyeScaleX: 0.9, browLY: 0.7, browRY: 0.7, browLRot: 0.1, browRRot: -0.1 };

            // Recover after a bit
            setTimeout(() => {
                const currentState = useAssistantStore.getState().state;
                if (currentState === 'WAITING') {
                    targetExpressions.current = { ...targetExpressions.current, color: '#ffffff', eyeScaleY: 1, eyeScaleX: 1, browLY: 0.5, browRY: 0.5, browLRot: 0, browRRot: 0 };
                }
            }, 500);
        }

        // Apply Dodge Velocity
        if (dodgeVelocity.current.lengthSq() > 0.01) {
            groupRef.current.position.add(dodgeVelocity.current.clone().multiplyScalar(0.1));
            dodgeVelocity.current.multiplyScalar(0.9); // friction
        }

        // Mouse tracking (look at cursor) with damping for smoothness
        let targetRotY = mouse.x * 0.5 + targetExpressions.current.rotY;
        let targetRotX = -mouse.y * 0.5 + targetExpressions.current.rotX;

        // Override to look at speech bubble (top left) if speaking
        if (state === 'SPEAKING' || state === 'LISTENING') {
            targetRotY = -0.4;
            targetRotX = 0.2;
        }

        // Apply look at (smooth lerp/damping)
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotY, 0.1);
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, 0.1);

        // Natural Blinking
        if (Math.random() > 0.995 && state !== 'SLEEPY' && state !== 'THINKING') { // Very rare per frame
            const previousScaleY = targetExpressions.current.eyeScaleY;
            targetExpressions.current.eyeScaleY = 0.05; // Blink down
            setTimeout(() => {
                // Restore if still active
                const currentState = useAssistantStore.getState().state;
                if (currentState !== 'SLEEPY' && currentState !== 'THINKING') {
                    targetExpressions.current.eyeScaleY = previousScaleY;
                }
            }, 100); // 100ms blink duration
        }

        // Floating
        const hover = Math.sin(time * 2) * 0.1;
        let scalePulse = 1.0;

        // Apply FFT lip sync / pulsing when playing TTS
        if (state === 'SPEAKING' && isPlayingTTS) {
            const data = getFrequencyData();
            if (data && data.length > 0) {
                // Average the lower frequency bands for "volume"
                let sum = 0;
                for (let i = 0; i < 8; i++) {
                    sum += data[i];
                }
                const avg = sum / 8;
                // Map volume 0-255 to a scale bump
                scalePulse = 1.0 + (avg / 255) * 0.15; // Max 15% bigger
            }
        }

        groupRef.current.position.y += hover * 0.05; // very subtle
        groupRef.current.scale.lerp(new THREE.Vector3(scalePulse, scalePulse, scalePulse), 0.2); // Animate scale

        // Update Spatial Audio Panner Position
        if (isPlayingTTS) {
            const worldPos = new THREE.Vector3();
            groupRef.current.getWorldPosition(worldPos);
            // Provide coordinates to WebAudio (Flip Z for WebAudio coordinate system commonly)
            setPannerPosition(worldPos.x, worldPos.y, worldPos.z);
        }

        // Lerp facial features natively without triggering React renders
        const lerpFactor = 0.2;
        if (leftEyeRef.current) {
            leftEyeRef.current.scale.x = THREE.MathUtils.lerp(leftEyeRef.current.scale.x, targetExpressions.current.eyeScaleX, lerpFactor);
            leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, targetExpressions.current.eyeScaleY, lerpFactor);
        }
        if (rightEyeRef.current) {
            rightEyeRef.current.scale.x = THREE.MathUtils.lerp(rightEyeRef.current.scale.x, targetExpressions.current.eyeScaleX, lerpFactor);
            rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, targetExpressions.current.eyeScaleY, lerpFactor);
        }
        if (leftBrowRef.current) {
            leftBrowRef.current.position.y = THREE.MathUtils.lerp(leftBrowRef.current.position.y, targetExpressions.current.browLY, lerpFactor);
            leftBrowRef.current.rotation.z = THREE.MathUtils.lerp(leftBrowRef.current.rotation.z, targetExpressions.current.browLRot, lerpFactor);
        }
        if (rightBrowRef.current) {
            rightBrowRef.current.position.y = THREE.MathUtils.lerp(rightBrowRef.current.position.y, targetExpressions.current.browRY, lerpFactor);
            rightBrowRef.current.rotation.z = THREE.MathUtils.lerp(rightBrowRef.current.rotation.z, targetExpressions.current.browRRot, lerpFactor);
        }

        // Animate material color smoothly
        if (meshRef.current && meshRef.current.material) {
            const mat = meshRef.current.material as any;
            if (mat && mat.color) {
                mat.color.lerp(new THREE.Color(targetExpressions.current.color), 0.1);
            }
        }
    });

    // Double click to trigger minimize/idle spin (Interaction)
    const handleDoubleClick = (e: any) => {
        e.stopPropagation();

        // Play minimize sound
        playBeep(800, 'sine', 0.1, 0.2);
        setTimeout(() => playBeep(1200, 'sine', 0.2, 0.2), 100);

        api.start({
            scale: [0.3, 0.3, 0.3],
            rotation: [0, Math.PI * 2, 0],
            config: { mass: 1, tension: 200, friction: 10 }
        });
        setTimeout(() => {
            api.start({ scale: [0.8, 0.8, 0.8], rotation: [0, 0, 0], config: config.wobbly });
        }, 2000);
    };

    return (
        // @ts-ignore - Spring types mixup with three fiber
        <a.group
            ref={groupRef}
            {...springProps}
            {...bind()}
            onDoubleClick={handleDoubleClick}
            onPointerOver={() => {
                document.body.style.cursor = 'grab';
                setTooltipVisible(true);
                setIgnoreMouseEvents(false);
            }}
            onPointerOut={() => {
                document.body.style.cursor = 'default';
                setTooltipVisible(false);
                setIgnoreMouseEvents(true);
            }}
            onPointerDown={() => document.body.style.cursor = 'grabbing'}
            onPointerUp={() => document.body.style.cursor = 'grab'}
        >
            <Html center>
                <div className="relative pointer-events-none mt-16 scale-[2]">
                    <Tooltip text={tooltipText} visible={tooltipVisible && state === 'WAITING'} />
                </div>
            </Html>

            {/* Environment Map for realistic glass reflections */}
            <Environment preset="city" />

            {/* Elegant transparent-compatible shadows */}
            <ContactShadows position={[0, -1.2, 0]} opacity={0.6} scale={5} blur={2.5} far={4} color="#000000" />

            {/* Body - Premium Glass/Jelly */}
            <RoundedBox args={[1.5, 1.5, 1.5]} radius={0.4} smoothness={4} ref={meshRef}>
                <MeshTransmissionMaterial
                    thickness={1.5}
                    roughness={0.1}
                    transmission={1}
                    ior={1.5}
                    chromaticAberration={0.06}
                    backside={true}
                />
            </RoundedBox>

            {/* Face Group */}
            <group position={[0, 0, 0.8]}>
                {/* Left Eye */}
                <mesh ref={leftEyeRef} position={[-0.3, 0.2, 0]} scale={[targetExpressions.current.eyeScaleX, targetExpressions.current.eyeScaleY, 1]}>
                    <sphereGeometry args={[0.15, 16, 16]} />
                    <meshBasicMaterial color="#1f2937" />
                </mesh>

                {/* Right Eye */}
                <mesh ref={rightEyeRef} position={[0.3, 0.2, 0]} scale={[targetExpressions.current.eyeScaleX, targetExpressions.current.eyeScaleY, 1]}>
                    <sphereGeometry args={[0.15, 16, 16]} />
                    <meshBasicMaterial color="#1f2937" />
                </mesh>

                {/* Left Brow */}
                <mesh ref={leftBrowRef} position={[-0.3, targetExpressions.current.browLY, 0]} rotation={[0, 0, targetExpressions.current.browLRot]}>
                    <boxGeometry args={[0.3, 0.08, 0.1]} />
                    <meshBasicMaterial color="#1f2937" />
                </mesh>

                {/* Right Brow */}
                <mesh ref={rightBrowRef} position={[0.3, targetExpressions.current.browRY, 0]} rotation={[0, 0, targetExpressions.current.browRRot]}>
                    <boxGeometry args={[0.3, 0.08, 0.1]} />
                    <meshBasicMaterial color="#1f2937" />
                </mesh>
            </group>
        </a.group>
    );
};
