// Google Cast API type definitions (minimal subset)
declare namespace chrome.cast.framework {
	export class CastContext {
		static getInstance(): CastContext;
		addEventListener(type: string, handler: (event: CastStateEventData) => void): void;
		getCastState(): string;
		requestSession(): void;
		getCurrentSession(): CastSession | null;
	}

	export interface CastStateEventData {
		castState: string;
	}

	export interface CastSession {
		endSession(stopCasting: boolean): void;
	}

	export const CastContextEventType: {
		CAST_STATE_CHANGED: string;
	};

	export const CastState: {
		NO_DEVICES_AVAILABLE: string;
		CONNECTED: string;
	};
}
