<script lang="ts">
	// Parkour-themed SVG animation for 404 errors
	export let size: number = 200;
</script>

<div class="flex justify-center items-center" style="width: {size}px; height: {size}px;">
	<svg 
		width={size} 
		height={size} 
		viewBox="0 0 200 200" 
		class="parkour-animation"
		aria-label="Parkour animation"
	>
		<!-- Background buildings/obstacles -->
		<rect x="10" y="120" width="30" height="60" fill="currentColor" class="opacity-20" />
		<rect x="50" y="100" width="25" height="80" fill="currentColor" class="opacity-20" />
		<rect x="85" y="140" width="20" height="40" fill="currentColor" class="opacity-20" />
		<rect x="120" y="110" width="35" height="70" fill="currentColor" class="opacity-20" />
		<rect x="165" y="130" width="25" height="50" fill="currentColor" class="opacity-20" />
		
		<!-- Animated parkour figure -->
		<g class="runner" transform-origin="100 100">
			<!-- Body -->
			<ellipse cx="100" cy="80" rx="3" ry="8" fill="currentColor" class="opacity-60" />
			<!-- Head -->
			<circle cx="100" cy="65" r="6" fill="currentColor" class="opacity-80" />
			<!-- Arms -->
			<line x1="97" y1="75" x2="90" y2="85" stroke="currentColor" stroke-width="2" class="opacity-60 arm-left" />
			<line x1="103" y1="75" x2="110" y2="70" stroke="currentColor" stroke-width="2" class="opacity-60 arm-right" />
			<!-- Legs -->
			<line x1="100" y1="88" x2="95" y2="105" stroke="currentColor" stroke-width="3" class="opacity-80 leg-left" />
			<line x1="100" y1="88" x2="108" y2="100" stroke="currentColor" stroke-width="3" class="opacity-80 leg-right" />
		</g>
		
		<!-- Motion lines -->
		<g class="motion-lines">
			<line x1="75" y1="70" x2="85" y2="72" stroke="currentColor" stroke-width="1" class="opacity-40" />
			<line x1="70" y1="80" x2="80" y2="82" stroke="currentColor" stroke-width="1" class="opacity-30" />
			<line x1="65" y1="90" x2="75" y2="92" stroke="currentColor" stroke-width="1" class="opacity-20" />
		</g>
		
		<!-- Ground -->
		<line x1="0" y1="180" x2="200" y2="180" stroke="currentColor" stroke-width="2" class="opacity-30" />
	</svg>
</div>

<style>
	.parkour-animation {
		color: hsl(var(--primary));
	}
	
	.runner {
		animation: parkourMove 4s ease-in-out infinite;
	}
	
	.motion-lines {
		animation: motionFade 2s ease-in-out infinite;
	}
	
	.arm-left {
		animation: armSwing 1s ease-in-out infinite;
		transform-origin: 97px 75px;
	}
	
	.arm-right {
		animation: armSwing 1s ease-in-out infinite reverse;
		transform-origin: 103px 75px;
	}
	
	.leg-left {
		animation: legKick 1.5s ease-in-out infinite;
		transform-origin: 100px 88px;
	}
	
	.leg-right {
		animation: legKick 1.5s ease-in-out infinite reverse;
		transform-origin: 100px 88px;
	}
	
	@keyframes parkourMove {
		0%, 100% {
			transform: translateX(0px) translateY(0px) rotate(0deg);
		}
		25% {
			transform: translateX(-10px) translateY(-15px) rotate(-5deg);
		}
		50% {
			transform: translateX(0px) translateY(-20px) rotate(0deg);
		}
		75% {
			transform: translateX(10px) translateY(-10px) rotate(5deg);
		}
	}
	
	@keyframes motionFade {
		0%, 100% {
			opacity: 0.4;
			transform: translateX(0px);
		}
		50% {
			opacity: 0.1;
			transform: translateX(-5px);
		}
	}
	
	@keyframes armSwing {
		0%, 100% {
			transform: rotate(0deg);
		}
		50% {
			transform: rotate(15deg);
		}
	}
	
	@keyframes legKick {
		0%, 100% {
			transform: rotate(0deg);
		}
		50% {
			transform: rotate(20deg);
		}
	}
</style>