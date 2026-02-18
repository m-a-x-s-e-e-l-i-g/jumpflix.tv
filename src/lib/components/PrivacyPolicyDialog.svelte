<script lang="ts">
	import {
		Dialog as DialogRoot,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';
	import { getLocale } from '$lib/paraglide/runtime.js';

	let { open = $bindable(false), children } = $props<{
		open?: boolean;
		children?: any;
	}>();

	const locale = $derived(getLocale());
</script>

<DialogRoot bind:open>
	{@render children?.()}

	<DialogContent class="max-h-[80vh] max-w-2xl overflow-y-auto">
		<DialogHeader>
			<DialogTitle>
				{#if locale === 'nl'}
					Privacybeleid
				{:else if locale === 'ja'}
					プライバシーポリシー
				{:else}
					Privacy Policy
				{/if}
			</DialogTitle>
			<DialogDescription class="text-xs">
				{#if locale === 'nl'}
					Laatst bijgewerkt: 4 november 2025
				{:else if locale === 'ja'}
					最終更新日：2025年11月4日
				{:else}
					Last updated: November 4, 2025
				{/if}
			</DialogDescription>
		</DialogHeader>

		<div class="space-y-4 text-sm">
			{#if locale === 'nl'}
				<div>
					<h3 class="mb-2 font-semibold">1. Welke gegevens verzamelen we?</h3>
					<p class="mb-2 text-muted-foreground">Bij JumpFlix verzamelen we de volgende gegevens:</p>
					<ul class="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
						<li>
							<strong class="text-foreground">Accountgegevens:</strong> E-mailadres en wachtwoord (versleuteld)
						</li>
						<li>
							<strong class="text-foreground">Kijkgeschiedenis:</strong> Welke video's je hebt bekeken
							en je voortgang
						</li>
						<li>
							<strong class="text-foreground">Communicatievoorkeuren:</strong> Je keuze om wel of geen
							updates te ontvangen
						</li>
					</ul>
				</div>

				<div>
					<h3 class="mb-2 font-semibold">2. Hoe gebruiken we je gegevens?</h3>
					<ul class="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
						<li>Je toegang geven tot JumpFlix en je kijkvoortgang opslaan</li>
						<li>Je account beveiligen</li>
						<li>
							Nieuws over nieuwe parkour-video's en updates sturen (alleen als je daarvoor hebt
							gekozen)
						</li>
						<li>Onze service verbeteren</li>
					</ul>
				</div>

				<div>
					<h3 class="mb-2 font-semibold">3. Marketing en communicatie</h3>
					<p class="mb-2 text-muted-foreground">
						Bij het aanmaken van je account kun je ervoor kiezen om nieuws en updates te ontvangen
						over:
					</p>
					<ul class="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
						<li>Nieuwe films en series op JumpFlix</li>
						<li>Updates over het platform</li>
						<li>Parkour-gerelateerde inhoud</li>
					</ul>
					<p class="mt-2 text-muted-foreground">
						Je kunt je op elk moment afmelden via de afmeldlink in elke e-mail of door je voorkeuren
						aan te passen in je accountinstellingen.
					</p>
				</div>

				<div>
					<h3 class="mb-2 font-semibold">4. Gegevens delen</h3>
					<p class="mb-2 text-muted-foreground">
						We verkopen je gegevens nooit aan derden. We delen alleen gegevens met:
					</p>
					<ul class="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
						<li>
							<strong class="text-foreground">Supabase:</strong> Voor authenticatie en database-hosting
						</li>
						<li>
							<strong class="text-foreground">Vimeo/YouTube:</strong> Voor het afspelen van video's
						</li>
					</ul>
				</div>

				<div>
					<h3 class="mb-2 font-semibold">5. Je rechten</h3>
					<p class="mb-2 text-muted-foreground">Je hebt het recht om:</p>
					<ul class="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
						<li>Toegang te krijgen tot je persoonlijke gegevens</li>
						<li>Je gegevens te laten corrigeren</li>
						<li>Je gegevens te laten verwijderen</li>
						<li>Bezwaar te maken tegen verwerking van je gegevens</li>
						<li>Je communicatievoorkeuren aan te passen</li>
					</ul>
				</div>

				<div>
					<h3 class="mb-2 font-semibold">6. Beveiliging</h3>
					<p class="text-muted-foreground">
						We nemen de beveiliging van je gegevens serieus en gebruiken industriestandaard
						beveiligingsmaatregelen, waaronder versleuteling en beveiligde authenticatie.
					</p>
				</div>
			{:else if locale === 'ja'}
				<div>
					<h3 class="mb-2 font-semibold">1. 収集するデータ</h3>
					<p class="mb-2 text-muted-foreground">JumpFlixでは、以下のデータを収集します：</p>
					<ul class="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
						<li>
							<strong class="text-foreground">アカウント情報：</strong
							>メールアドレスとパスワード（暗号化）
						</li>
						<li><strong class="text-foreground">視聴履歴：</strong>視聴した動画と進捗状況</li>
						<li><strong class="text-foreground">通信設定：</strong>最新情報の受信に関する選択</li>
					</ul>
				</div>

				<div>
					<h3 class="mb-2 font-semibold">2. データの使用方法</h3>
					<ul class="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
						<li>JumpFlixへのアクセス提供と視聴進捗の保存</li>
						<li>アカウントのセキュリティ保護</li>
						<li>新しいパルクール動画や更新情報の送信（オプトインした場合のみ）</li>
						<li>サービスの改善</li>
					</ul>
				</div>

				<div>
					<h3 class="mb-2 font-semibold">3. マーケティングとコミュニケーション</h3>
					<p class="mb-2 text-muted-foreground">
						アカウント作成時に、以下に関するニュースと更新情報の受信を選択できます：
					</p>
					<ul class="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
						<li>JumpFlixの新作映画とシリーズ</li>
						<li>プラットフォームの更新</li>
						<li>パルクール関連コンテンツ</li>
					</ul>
					<p class="mt-2 text-muted-foreground">
						メール内の配信停止リンクから、またはアカウント設定で設定を変更することで、いつでも配信停止できます。
					</p>
				</div>

				<div>
					<h3 class="mb-2 font-semibold">4. データの共有</h3>
					<p class="mb-2 text-muted-foreground">
						データを第三者に販売することはありません。以下のサービスとのみデータを共有します：
					</p>
					<ul class="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
						<li>
							<strong class="text-foreground">Supabase：</strong>認証とデータベースホスティング用
						</li>
						<li><strong class="text-foreground">Vimeo/YouTube：</strong>動画再生用</li>
					</ul>
				</div>

				<div>
					<h3 class="mb-2 font-semibold">5. あなたの権利</h3>
					<p class="mb-2 text-muted-foreground">以下の権利があります：</p>
					<ul class="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
						<li>個人データへのアクセス</li>
						<li>データの修正</li>
						<li>データの削除</li>
						<li>データ処理への異議申し立て</li>
						<li>通信設定の更新</li>
					</ul>
				</div>

				<div>
					<h3 class="mb-2 font-semibold">6. セキュリティ</h3>
					<p class="text-muted-foreground">
						データのセキュリティを重視し、暗号化と安全な認証を含む業界標準のセキュリティ対策を使用しています。
					</p>
				</div>
			{:else}
				<div>
					<h3 class="mb-2 font-semibold">1. What data do we collect?</h3>
					<p class="mb-2 text-muted-foreground">At JumpFlix, we collect the following data:</p>
					<ul class="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
						<li>
							<strong class="text-foreground">Account information:</strong> Email address and password
							(encrypted)
						</li>
						<li>
							<strong class="text-foreground">Watch history:</strong> Which videos you've watched and
							your progress
						</li>
						<li>
							<strong class="text-foreground">Communication preferences:</strong> Your choice to receive
							or not receive updates
						</li>
					</ul>
				</div>

				<div>
					<h3 class="mb-2 font-semibold">2. How do we use your data?</h3>
					<ul class="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
						<li>Provide you access to JumpFlix and save your watch progress</li>
						<li>Secure your account</li>
						<li>Send news about new parkour videos and updates (only if you opted in)</li>
						<li>Improve our service</li>
					</ul>
				</div>

				<div>
					<h3 class="mb-2 font-semibold">3. Marketing and communication</h3>
					<p class="mb-2 text-muted-foreground">
						When creating your account, you can choose to receive news and updates about:
					</p>
					<ul class="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
						<li>New movies and series on JumpFlix</li>
						<li>Platform updates</li>
						<li>Parkour-related content</li>
					</ul>
					<p class="mt-2 text-muted-foreground">
						You can unsubscribe at any time via the unsubscribe link in each email or by adjusting
						your preferences in your account settings.
					</p>
				</div>

				<div>
					<h3 class="mb-2 font-semibold">4. Data sharing</h3>
					<p class="mb-2 text-muted-foreground">
						We never sell your data to third parties. We only share data with:
					</p>
					<ul class="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
						<li>
							<strong class="text-foreground">Supabase:</strong> For authentication and database hosting
						</li>
						<li><strong class="text-foreground">Vimeo/YouTube:</strong> For video playback</li>
					</ul>
				</div>

				<div>
					<h3 class="mb-2 font-semibold">5. Your rights</h3>
					<p class="mb-2 text-muted-foreground">You have the right to:</p>
					<ul class="ml-2 list-inside list-disc space-y-1 text-muted-foreground">
						<li>Access your personal data</li>
						<li>Have your data corrected</li>
						<li>Have your data deleted</li>
						<li>Object to processing of your data</li>
						<li>Update your communication preferences</li>
					</ul>
				</div>

				<div>
					<h3 class="mb-2 font-semibold">6. Security</h3>
					<p class="text-muted-foreground">
						We take the security of your data seriously and use industry-standard security measures,
						including encryption and secure authentication.
					</p>
				</div>
			{/if}
		</div>
	</DialogContent>
</DialogRoot>
