import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgePercent, CalendarCheck, ChartColumnBig as ChartBar, ChevronLeft, ChevronRight, Clock, Dumbbell, LayoutGrid, LogOut, Moon, Search, Sun, UserRound, Users } from "lucide-react";

import { apiErrorMessage } from "../../lib/axios";
import {
	createCoupon,
	getCoupons,
	setCouponActive,
	type Coupon,
	type CouponCreatePayload,
} from "../../services/couponService";
import {
	createPlan,
	getAllPlans,
	getPlans,
	setPlanActive,
	updatePlan,
	type Plan,
	type PlanWritePayload,
} from "../../services/planService";
import {
	getMemberAttendance,
	getTodayCheckIns,
	getTrainerDashboard,
	markAttendance,
	type AttendanceRecord,
	type TodayCheckIn,
	type TrainerDashboard,
} from "../../services/checkinService";
import {
	getMyProfile,
	getUserById,
	listMembers,
	listTrainers,
	updateMyProfile,
	type MemberListItem,
	type TrainerListItem,
} from "../../services/userService";
import { getActiveSubscriptionForMember, type Subscription } from "../../services/subscriptionService";
import {
	getAnalytics,
	getMemberCohort,
	type Analytics,
	type CohortMember,
	type MemberCohort,
	type PlanBreakdownItem,
} from "../../services/analyticsService";
import { useTabRoute } from "../../hooks/useTabRoute";
import { roleLabels } from "../../router/routes";
import type { AuthUser, MemberProfile } from "../../store/authStore";

/**
 * Admin sees plan and coupon management plus the member list.
 * Trainer sees three tabs: attendance, a read-only catalogue, and their profile.
 */
const STAFF_TABS = ["analytics", "members", "attendance", "plans", "coupons", "catalogue", "profile"] as const;
type StaffTab = (typeof STAFF_TABS)[number];

const money = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
const dateLabel = (value?: string | null) =>
	value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const toDateInput = (value: string) => new Date(value).toISOString().slice(0, 10);

export default function StaffWorkspace({
	user,
	darkMode,
	setDarkMode,
	onLogout,
}: {
	user: AuthUser;
	darkMode: boolean;
	setDarkMode: (value: boolean) => void;
	onLogout: () => void;
}) {
	const isAdmin = user.role === "owner";
	// Trainers land on attendance — the thing they do all day.
	// Admins land on Analytics and the logo returns there; trainers have no
	// analytics tab, so they land on their member list.
	const homeTab: StaffTab = isAdmin ? "analytics" : "members";
	// URL-backed, so a staff view can be linked to and the back button works.
	// Set while a member profile is open on the Members tab.
	const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
	const [tab, setTab] = useTabRoute<StaffTab>({
		validTabs: STAFF_TABS,
		fallback: homeTab,
		basePath: "/app",
	});

	const tabs = useMemo(
		() =>
			(isAdmin
				? ([
						["analytics", ChartBar, "Analytics"],
						["members", Users, "Members"],
						["attendance", CalendarCheck, "Attendance"],
						["plans", LayoutGrid, "Plans"],
						["coupons", BadgePercent, "Coupons"],
				  ] as const)
				: // Trainers: mark attendance, look up what is on sale, manage their
				  // own profile. Plan and coupon editing stays with the Admin.
				  ([
						["members", CalendarCheck, "Attendance"],
						["catalogue", LayoutGrid, "Plans & offers"],
						["profile", UserRound, "Profile"],
				  ] as const)),
		[isAdmin],
	);

	return (
		<div className="dashboard">
			<header className="mobile-header">
				{/* Empty side balances the actions on the right so the logo sits
				    in the true centre of the bar. */}
				<div className="header-side" />
				<button
					className="brand brand-button"
					onClick={() => setTab(homeTab)}
					aria-label="Go to home"
				>
					<span className="brand-mark"><Dumbbell size={19} /></span>
					<span className="brand-text">FITCORE</span>
				</button>
				<div className="header-actions header-side">
					<span className="role-chip">{roleLabels[user.role]}</span>
					<button className="icon-button" onClick={() => setDarkMode(!darkMode)} aria-label="Toggle theme">
						{darkMode ? <Sun size={18} /> : <Moon size={18} />}
					</button>
					<button className="icon-button" onClick={onLogout} aria-label="Sign out"><LogOut size={18} /></button>
				</div>
			</header>

			<div className="app-body">
				<main className="staff-main">
					<div className="page-title">
						<p className="eyebrow"></p>
						
					</div>

					{tab === "plans" && isAdmin && <PlanManager />}
					{tab === "coupons" && isAdmin && <CouponManager />}
					{tab === "members" && (
						selectedMemberId
							? <MemberDetail memberId={selectedMemberId} onBack={() => setSelectedMemberId(null)} />
							: <MemberDirectory onOpenMember={setSelectedMemberId} />
					)}
					{tab === "attendance" && <AttendanceRecorder isAdmin={isAdmin} />}
					{tab === "analytics" && isAdmin && <AnalyticsView />}
					{tab === "catalogue" && <CatalogueView />}
					{tab === "profile" && <StaffProfileView user={user} />}
				</main>

				{/* One nav, two shapes: a sidebar from 900px up, a bottom bar below. */}
				<nav className="app-nav" aria-label="Workspace navigation">
					{tabs.map(([key, Icon, label]) => (
						<button
							key={key}
							aria-current={tab === key ? "page" : undefined}
							className={tab === key ? "nav-item active" : "nav-item"}
							onClick={() => setTab(key)}
						>
							<Icon size={19} />
							<span>{label}</span>
						</button>
					))}
				</nav>
			</div>
		</div>
	);
}

/* ── Admin: plan management ─────────────────────────────────────────────── */

const emptyPlanForm = { plan_name: "", description: "", category: "standard", price_inr: "", calendar_days: "", allocated_days: "", features: "" };

function PlanManager() {
	const [plans, setPlans] = useState<Plan[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [showForm, setShowForm] = useState(false);
	const [saving, setSaving] = useState(false);
	const [form, setForm] = useState(emptyPlanForm);

	const load = useCallback(async () => {
		setLoading(true);
		try { setPlans(await getAllPlans()); setError(""); }
		catch (requestError) { setError(apiErrorMessage(requestError)); }
		finally { setLoading(false); }
	}, []);

	useEffect(() => { void load(); }, [load]);

	function openCreate() {
		setEditingId(null); setForm(emptyPlanForm); setShowForm(true); setNotice(""); setError("");
	}

	function openEdit(plan: Plan) {
		setEditingId(plan.id);
		setForm({
			plan_name: plan.plan_name,
			description: plan.description ?? "",
			category: plan.category,
			price_inr: String(plan.price_paise / 100),
			calendar_days: String(plan.calendar_days),
			allocated_days: String(plan.allocated_days),
			features: plan.features.join(", "),
		});
		setShowForm(true); setNotice(""); setError("");
	}

	async function save() {
		const priceInr = Number(form.price_inr);
		const calendarDays = Number(form.calendar_days);
		const allocatedDays = Number(form.allocated_days);
		if (!form.plan_name.trim() || form.plan_name.trim().length < 2) return setError("Plan name must be at least 2 characters.");
		if (!(priceInr > 0)) return setError("Enter a price greater than zero.");
		if (!(calendarDays > 0) || !(allocatedDays > 0)) return setError("Calendar days and gym visits must be greater than zero.");
		if (allocatedDays > calendarDays) return setError("Gym visits cannot exceed the calendar days of the plan.");

		const payload: PlanWritePayload = {
			plan_name: form.plan_name.trim(),
			description: form.description.trim() || undefined,
			category: form.category,
			price_paise: Math.round(priceInr * 100),
			calendar_days: calendarDays,
			allocated_days: allocatedDays,
			features: form.features.split(",").map((item) => item.trim()).filter(Boolean),
		};

		setSaving(true); setError("");
		try {
			if (editingId) { await updatePlan(editingId, payload); setNotice("Plan updated."); }
			else { await createPlan(payload); setNotice("Plan created."); }
			setShowForm(false); setEditingId(null); setForm(emptyPlanForm);
			await load();
		} catch (requestError) { setError(apiErrorMessage(requestError)); }
		finally { setSaving(false); }
	}

	async function toggleActive(plan: Plan) {
		setError(""); setNotice("");
		try {
			await setPlanActive(plan.id, !plan.is_active);
			setNotice(plan.is_active ? `${plan.plan_name} deactivated.` : `${plan.plan_name} activated.`);
			await load();
		} catch (requestError) { setError(apiErrorMessage(requestError)); }
	}

	const change = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
		setForm((current) => ({ ...current, [key]: event.target.value }));

	const activePlans = plans.filter((plan) => plan.is_active);
	const inactivePlans = plans.filter((plan) => !plan.is_active);

	const sections = useMemo(
		() => [
			{ id: "active-plans", label: "Active plans" },
			{ id: "inactive-plans", label: "Inactive plans" },
			{ id: "add-plan", label: "Add new plan" },
		],
		[],
	);
	const { activeSection, jumpTo } = useSectionJump(sections);

	/** Opens the form and scrolls to it, so "Add new plan" always lands there. */
	function startCreate() {
		openCreate();
		window.setTimeout(() => jumpTo("add-plan"), 60);
	}

	function startEdit(plan: Plan) {
		openEdit(plan);
		window.setTimeout(() => jumpTo("add-plan"), 60);
	}

	return (
		<section className="view-stack">
			<SectionJump
				sections={sections}
				activeSection={activeSection}
				onJump={(id) => { if (id === "add-plan" && !showForm) startCreate(); else jumpTo(id); }}
			/>

			{error && <div className="error-message">{error}</div>}
			{notice && <div className="profile-message">{notice}</div>}

			<div id="active-plans" className="jump-target">
				<div className="section-heading">
					<div><p className="eyebrow">Plan management</p><h2>Active plans</h2></div>
				</div>
				{loading ? <div className="loading-state">Loading plans...</div>
					: activePlans.length === 0 ? <div className="empty-state">No active plans. Add one below.</div>
					: <div className="plan-list">{activePlans.map((plan) => renderPlanCard(plan))}</div>}
			</div>

			<div id="inactive-plans" className="jump-target">
				<div className="section-heading">
					<div><p className="eyebrow">Archived</p><h2>Inactive plans</h2></div>
				</div>
				{inactivePlans.length === 0
					? <div className="empty-state">No archived plans.</div>
					: <div className="plan-list">{inactivePlans.map((plan) => renderPlanCard(plan))}</div>}
			</div>

			<div id="add-plan" className="jump-target">
				<div className="section-heading">
					<div><p className="eyebrow">Create</p><h2>{editingId ? "Edit plan" : "Add new plan"}</h2></div>
					{!showForm && <button className="primary-action compact-button" onClick={startCreate}>New plan</button>}
				</div>

			{showForm && (
				<article className="staff-form">
					<h3>{editingId ? "Edit plan" : "Create plan"}</h3>
					<div className="profile-form-grid">
						<div className="field"><label>Plan name</label><input value={form.plan_name} onChange={change("plan_name")} placeholder="e.g. Quarterly Pro" /></div>
						<div className="field"><label>Category</label>
							<select value={form.category} onChange={change("category")}>
								<option value="basic">basic</option><option value="standard">standard</option><option value="premium">premium</option>
							</select>
						</div>
						<div className="field"><label>Price (₹)</label><input type="number" min="1" value={form.price_inr} onChange={change("price_inr")} placeholder="1500" /></div>
						<div className="field"><label>Calendar days</label><input type="number" min="1" value={form.calendar_days} onChange={change("calendar_days")} placeholder="90" /></div>
						<div className="field"><label>Gym visits</label><input type="number" min="1" value={form.allocated_days} onChange={change("allocated_days")} placeholder="60" /></div>
						<div className="field"><label>Description</label><input value={form.description} onChange={change("description")} placeholder="Short summary" /></div>
					</div>
					<div className="field"><label>Features <span className="optional-label">comma separated</span></label><input value={form.features} onChange={change("features")} placeholder="Locker, Steam room, Diet plan" /></div>
					<div className="form-actions">
						<button className="primary-action" onClick={save} disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Create plan"}</button>
						<button className="outline-button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
					</div>
				</article>
			)}

			</div>
		</section>
	);

	function renderPlanCard(plan: Plan) {
		return (
			<article className={plan.is_active ? "plan-card" : "plan-card inactive"} key={plan.id}>
				<div className="plan-card-top">
					<span className="plan-category">{plan.category}</span>
					<strong>{money(plan.price_paise)}</strong>
				</div>
				<h3>{plan.plan_name}</h3>
				<p>{plan.description || "No description."}</p>
				<div className="plan-meta"><span>{plan.calendar_days} calendar days</span><span>{plan.allocated_days} gym visits</span></div>
				<span className={plan.is_active ? "status-dot" : "status-dot failed"}>{plan.is_active ? "Active" : "Archived"}</span>
				<div className="form-actions">
					<button className="outline-button compact-button" onClick={() => startEdit(plan)}>Edit</button>
					<button className="outline-button compact-button" onClick={() => toggleActive(plan)}>{plan.is_active ? "Deactivate" : "Activate"}</button>
				</div>
			</article>
		);
	}
}

/* ── Admin: coupon management ───────────────────────────────────────────── */

const emptyCouponForm = { code: "", name: "", description: "", discount_type: "percentage", discount_value: "", min_plan_price_inr: "0", max_discount_inr: "", max_uses: "100", per_user_limit: "1", valid_until: "" };

function CouponManager() {
	const [coupons, setCoupons] = useState<Coupon[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [showForm, setShowForm] = useState(false);
	const [saving, setSaving] = useState(false);
	const [form, setForm] = useState(emptyCouponForm);

	const load = useCallback(async () => {
		setLoading(true);
		try { setCoupons(await getCoupons()); setError(""); }
		catch (requestError) { setError(apiErrorMessage(requestError)); }
		finally { setLoading(false); }
	}, []);

	useEffect(() => { void load(); }, [load]);

	async function save() {
		const discountValue = Number(form.discount_value);
		if (form.code.trim().length < 3) return setError("Coupon code must be at least 3 characters.");
		if (form.name.trim().length < 2) return setError("Coupon name must be at least 2 characters.");
		if (!(discountValue > 0)) return setError("Discount value must be greater than zero.");
		if (form.discount_type === "percentage" && discountValue > 100) return setError("A percentage discount cannot exceed 100.");
		if (!form.valid_until) return setError("Choose an expiry date.");

		const payload: CouponCreatePayload = {
			code: form.code.trim().toUpperCase(),
			name: form.name.trim(),
			description: form.description.trim() || undefined,
			discount_type: form.discount_type,
			// A flat discount is entered in rupees but stored in paise.
			discount_value: form.discount_type === "flat_paise" ? Math.round(discountValue * 100) : discountValue,
			min_plan_price_paise: Math.round(Number(form.min_plan_price_inr || 0) * 100),
			max_discount_paise: form.max_discount_inr ? Math.round(Number(form.max_discount_inr) * 100) : null,
			max_uses: Number(form.max_uses || 100),
			per_user_limit: Number(form.per_user_limit || 1),
			applicable_to: ["all"],
			valid_until: new Date(`${form.valid_until}T23:59:59`).toISOString(),
		};

		setSaving(true); setError("");
		try {
			await createCoupon(payload);
			setNotice(`Coupon ${payload.code} created.`);
			setShowForm(false); setForm(emptyCouponForm);
			await load();
		} catch (requestError) { setError(apiErrorMessage(requestError)); }
		finally { setSaving(false); }
	}

	async function toggleActive(coupon: Coupon) {
		setError(""); setNotice("");
		try {
			await setCouponActive(coupon.id, !coupon.is_active);
			setNotice(coupon.is_active ? `${coupon.code} deactivated.` : `${coupon.code} activated.`);
			await load();
		} catch (requestError) { setError(apiErrorMessage(requestError)); }
	}

	const change = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
		setForm((current) => ({ ...current, [key]: event.target.value }));

	const discountLabel = (coupon: Coupon) =>
		coupon.discount_type === "percentage" ? `${coupon.discount_value}% off` : `${money(coupon.discount_value)} off`;

	const activeCoupons = coupons.filter((coupon) => coupon.is_active);
	const inactiveCoupons = coupons.filter((coupon) => !coupon.is_active);

	const sections = useMemo(
		() => [
			{ id: "active-coupons", label: "Active coupons" },
			{ id: "inactive-coupons", label: "Inactive coupons" },
			{ id: "add-coupon", label: "Add new coupon" },
		],
		[],
	);
	const { activeSection, jumpTo } = useSectionJump(sections);

	function startCreate() {
		setForm(emptyCouponForm); setShowForm(true); setNotice(""); setError("");
		window.setTimeout(() => jumpTo("add-coupon"), 60);
	}

	return (
		<section className="view-stack">
			<SectionJump
				sections={sections}
				activeSection={activeSection}
				onJump={(id) => { if (id === "add-coupon" && !showForm) startCreate(); else jumpTo(id); }}
			/>

			{error && <div className="error-message">{error}</div>}
			{notice && <div className="profile-message">{notice}</div>}

			<div id="active-coupons" className="jump-target">
				<div className="section-heading">
					<div><p className="eyebrow">Coupon management</p><h2>Active coupons</h2></div>
					<span className="muted">{activeCoupons.length} running</span>
				</div>
				{loading ? <div className="loading-state">Loading coupons...</div>
					: activeCoupons.length === 0 ? <div className="empty-state">No active coupons. Add one below.</div>
					: <div className="history-list">{activeCoupons.map((coupon) => renderCouponRow(coupon))}</div>}
			</div>

			<div id="inactive-coupons" className="jump-target">
				<div className="section-heading">
					<div><p className="eyebrow">Archived</p><h2>Inactive coupons</h2></div>
					<span className="muted">{inactiveCoupons.length} archived</span>
				</div>
				{inactiveCoupons.length === 0
					? <div className="empty-state">No inactive coupons.</div>
					: <div className="history-list">{inactiveCoupons.map((coupon) => renderCouponRow(coupon))}</div>}
			</div>

			<div id="add-coupon" className="jump-target">
				<div className="section-heading">
					<div><p className="eyebrow">Create</p><h2>Add new coupon</h2></div>
					{!showForm && <button className="primary-action compact-button" onClick={startCreate}>New coupon</button>}
				</div>

			{showForm && (
				<article className="staff-form">
					<h3>Create coupon</h3>
					<div className="profile-form-grid">
						<div className="field"><label>Code</label><input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="NEWYEAR25" /></div>
						<div className="field"><label>Name</label><input value={form.name} onChange={change("name")} placeholder="New Year Offer" /></div>
						<div className="field"><label>Discount type</label>
							<select value={form.discount_type} onChange={change("discount_type")}>
								<option value="percentage">percentage</option><option value="flat_paise">flat amount</option>
							</select>
						</div>
						<div className="field"><label>{form.discount_type === "percentage" ? "Discount (%)" : "Discount (₹)"}</label><input type="number" min="1" value={form.discount_value} onChange={change("discount_value")} /></div>
						<div className="field"><label>Min plan price (₹)</label><input type="number" min="0" value={form.min_plan_price_inr} onChange={change("min_plan_price_inr")} /></div>
						<div className="field"><label>Max discount (₹) <span className="optional-label">optional</span></label><input type="number" min="0" value={form.max_discount_inr} onChange={change("max_discount_inr")} /></div>
						<div className="field"><label>Max total uses</label><input type="number" min="1" value={form.max_uses} onChange={change("max_uses")} /></div>
						<div className="field"><label>Per user limit</label><input type="number" min="1" value={form.per_user_limit} onChange={change("per_user_limit")} /></div>
						<div className="field"><label>Valid until</label><input type="date" value={form.valid_until} onChange={change("valid_until")} /></div>
					</div>
					<div className="field"><label>Description</label><input value={form.description} onChange={change("description")} placeholder="Shown to members at checkout" /></div>
					<div className="form-actions">
						<button className="primary-action" onClick={save} disabled={saving}>{saving ? "Saving..." : "Create coupon"}</button>
						<button className="outline-button" onClick={() => setShowForm(false)}>Cancel</button>
					</div>
				</article>
			)}

			</div>
		</section>
	);

	function renderCouponRow(coupon: Coupon) {
		return (
			<article className="coupon-row" key={coupon.id}>
				<div className="coupon-row-main">
					<div><strong>{coupon.code}</strong><span>{coupon.name} · {discountLabel(coupon)}</span></div>
					<span className={coupon.is_active ? "status-dot" : "status-dot failed"}>{coupon.is_active ? "Active" : "Inactive"}</span>
				</div>
				<div className="coupon-row-meta">
					<span>Used {coupon.current_uses}/{coupon.max_uses}</span>
					<span>Limit {coupon.per_user_limit}/user</span>
					<span>Expires {dateLabel(coupon.valid_until)}</span>
				</div>
				<button className="outline-button compact-button" onClick={() => toggleActive(coupon)}>{coupon.is_active ? "Deactivate" : "Activate"}</button>
			</article>
		);
	}
}

/* ── Trainer/Admin: members and attendance ──────────────────────────────── */

function MemberManager({ isAdmin }: { isAdmin: boolean }) {
	const [members, setMembers] = useState<MemberListItem[]>([]);
	const [today, setToday] = useState<TodayCheckIn[]>([]);
	const [summary, setSummary] = useState<TrainerDashboard | null>(null);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [markingId, setMarkingId] = useState<string | null>(null);

	const load = useCallback(async (term: string) => {
		setLoading(true);
		// allSettled so a failing summary never blanks the member list.
		const [memberResult, todayResult, summaryResult] = await Promise.allSettled([
			listMembers({ search: term, role: "member", limit: 50 }),
			getTodayCheckIns(),
			getTrainerDashboard(),
		]);
		if (memberResult.status === "fulfilled") { setMembers(memberResult.value.items); setError(""); }
		else setError(apiErrorMessage(memberResult.reason));
		if (todayResult.status === "fulfilled") setToday(todayResult.value);
		if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
		setLoading(false);
	}, []);

	useEffect(() => { void load(""); }, [load]);

	// Debounce so typing does not fire a request per keystroke.
	useEffect(() => {
		const timer = window.setTimeout(() => { void load(search.trim()); }, 350);
		return () => window.clearTimeout(timer);
	}, [search, load]);

	const checkedInIds = useMemo(() => new Set(today.map((item) => item.member.id)), [today]);

	async function mark(member: MemberListItem) {
		setMarkingId(member.id); setError(""); setNotice("");
		try {
			const result = await markAttendance(member.id);
			setNotice(result.message ?? `Attendance marked for ${member.full_name}.`);
			// Refresh both, so the list and the counter stay in step.
			const [refreshedToday, refreshedSummary] = await Promise.allSettled([
				getTodayCheckIns(),
				getTrainerDashboard(),
			]);
			if (refreshedToday.status === "fulfilled") setToday(refreshedToday.value);
			if (refreshedSummary.status === "fulfilled") setSummary(refreshedSummary.value);
		} catch (requestError) {
			// Covers no active plan, expired plan and exhausted quota.
			setError(apiErrorMessage(requestError));
		} finally { setMarkingId(null); }
	}

	return (
		<section className="view-stack">
			<div className="section-heading">
				<div><p className="eyebrow">Attendance</p><h2>Members</h2></div>
				<span className="muted">{today.length} checked in today</span>
			</div>

			{/* Floor summary. Admins get the fuller picture on their own dashboard. */}
			{!isAdmin && summary && (
				<div className="insight-grid">
					<article className="insight-card accent-card">
						<CalendarCheck size={19} />
						<strong>{summary.checkins_today}</strong>
						<span>checked in today</span>
					</article>
					<article className="insight-card">
						<Clock size={19} />
						<strong>{summary.expiring_soon_count}</strong>
						<span>renewals due this week</span>
					</article>
				</div>
			)}

			{!isAdmin && summary?.last_checkin && (
				<p className="muted last-checkin-note">
					Last in: <strong>{summary.last_checkin.member_name}</strong> at{" "}
					{new Date(summary.last_checkin.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
				</p>
			)}

			<div className="search-row">
				<Search size={16} />
				<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name or phone" aria-label="Search members" />
			</div>

			{error && <div className="error-message">{error}</div>}
			{notice && <div className="profile-message">{notice}</div>}

			{loading ? <div className="loading-state">Loading members...</div> : members.length === 0 ? <div className="empty-state">No members matched your search.</div> : (
				<div className="history-list">
					{members.map((member) => {
						const done = checkedInIds.has(member.id);
						return (
							<article className="history-row" key={member.id}>
								<div>
									<strong>{member.full_name}</strong>
									<span>{member.phone} · {member.gym_meta.membership_status}</span>
								</div>
								{done
									? <span className="status-dot">Present today</span>
									: <button className="outline-button compact-button" onClick={() => mark(member)} disabled={markingId === member.id}>
											{markingId === member.id ? "Marking..." : <>Mark present <ChevronRight size={15} /></>}
										</button>}
							</article>
						);
					})}
				</div>
			)}

			{today.length > 0 && (
				<>
					<div className="section-heading"><h2><CalendarCheck size={18} /> Today&apos;s check-ins</h2></div>
					<div className="history-list">
						{today.map((item) => (
							<article className="history-row" key={item.member.id}>
								<div>
									<strong>{item.member.full_name}</strong>
									<span>{new Date(item.check_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
								</div>
								<span className="muted">{item.days_remaining} days left</span>
							</article>
						))}
					</div>
				</>
			)}
		</section>
	);
}

/* ── Trainer: read-only plan and offer catalogue ─────────────────────────── */

/**
 * What a trainer needs at the desk when a member asks "what do you have, and
 * is there a discount on it?" — active plans and live coupons, nothing
 * editable. Plan and coupon management stays with the Admin.
 */
function CatalogueView() {
	const [plans, setPlans] = useState<Plan[]>([]);
	const [coupons, setCoupons] = useState<Coupon[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const [planResult, couponResult] = await Promise.allSettled([getPlans(), getCoupons()]);
			if (cancelled) return;
			if (planResult.status === "fulfilled") { setPlans(planResult.value); setError(""); }
			else setError(apiErrorMessage(planResult.reason));
			// Coupons are readable by staff, but a failure here should not hide
			// the plans, so it is swallowed rather than surfaced.
			if (couponResult.status === "fulfilled") setCoupons(couponResult.value);
			setLoading(false);
		})();
		return () => { cancelled = true; };
	}, []);

	// Only offers a member could actually use today.
	const liveCoupons = useMemo(
		() => coupons.filter((c) => c.is_active && new Date(c.valid_until) >= new Date()),
		[coupons],
	);

	const discountLabel = (coupon: Coupon) =>
		coupon.discount_type === "percentage"
			? `${coupon.discount_value}% off`
			: `${money(coupon.discount_value)} off`;

	if (loading) return <div className="loading-state">Loading plans and offers...</div>;

	return (
		<section className="view-stack">
			<div className="section-heading">
				<div><p className="eyebrow">Catalogue</p><h2>Active plans</h2></div>
			</div>

			{error && <div className="error-message">{error}</div>}

			{plans.length === 0 ? (
				<div className="empty-state">No active plans right now.</div>
			) : (
				<div className="history-list">
					{plans.map((plan) => (
						<article className="history-row catalogue-row" key={plan.id}>
							<div>
								<strong>{plan.plan_name}</strong>
								<span>
									{money(plan.price_paise)} · {plan.calendar_days} days · {plan.allocated_days} visits
								</span>
								{plan.features.length > 0 && (
									<small className="muted">{plan.features.join(" · ")}</small>
								)}
							</div>
							<span className="role-chip">{plan.category}</span>
						</article>
					))}
				</div>
			)}

			<div className="section-heading">
				<div><p className="eyebrow">Offers</p><h2>Running coupons</h2></div>
				<span className="muted">{liveCoupons.length} live</span>
			</div>

			{liveCoupons.length === 0 ? (
				<div className="empty-state">No offers are running at the moment.</div>
			) : (
				<div className="history-list">
					{liveCoupons.map((coupon) => (
						<article className="history-row catalogue-row" key={coupon.id}>
							<div>
								<strong>{coupon.code}</strong>
								<span>{discountLabel(coupon)} · {coupon.name}</span>
								<small className="muted">
									Valid till {dateLabel(coupon.valid_until)}
									{coupon.min_plan_price_paise > 0 && ` · min ${money(coupon.min_plan_price_paise)}`}
									{` · ${Math.max(0, coupon.max_uses - coupon.current_uses)} left`}
								</small>
							</div>
							<span className="status-dot">Live</span>
						</article>
					))}
				</div>
			)}

			<p className="muted catalogue-note">
				View only. Ask an Admin to add or change a plan or offer.
			</p>
		</section>
	);
}

/* ── Staff: own profile ──────────────────────────────────────────────────── */

const emptyStaffProfileForm = {
	full_name: "",
	dob: "",
	gender: "",
	blood_group: "",
	street: "",
	city: "",
	state: "",
	pincode: "",
};

/**
 * A trainer's own profile, matching the fields members can edit.
 *
 * Phone and email are shown but locked: the backend refuses to change a phone
 * at all, and rejects changing an email once it is set (EMAIL_IMMUTABLE).
 */
function StaffProfileView({ user }: { user: AuthUser }) {
	const [profile, setProfile] = useState<MemberProfile | null>(null);
	const [form, setForm] = useState(emptyStaffProfileForm);
	const [editing, setEditing] = useState(false);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");

	const hydrate = useCallback((next: MemberProfile) => {
		setProfile(next);
		setForm({
			full_name: next.full_name ?? "",
			dob: next.profile?.dob ?? "",
			gender: next.profile?.gender ?? "",
			blood_group: next.profile?.blood_group ?? "",
			street: next.profile?.address?.street ?? "",
			city: next.profile?.address?.city ?? "",
			state: next.profile?.address?.state ?? "",
			pincode: next.profile?.address?.pincode ?? "",
		});
	}, []);

	useEffect(() => {
		let cancelled = false;
		getMyProfile()
			.then((next) => { if (!cancelled) hydrate(next); })
			.catch((requestError) => { if (!cancelled) setError(apiErrorMessage(requestError)); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [hydrate]);

	const change = (key: keyof typeof emptyStaffProfileForm) =>
		(event: React.ChangeEvent<HTMLInputElement>) =>
			setForm((prev) => ({ ...prev, [key]: event.target.value }));

	async function save() {
		setSaving(true); setMessage(""); setError("");
		try {
			// Send only what the backend accepts; blanks are omitted so an empty
			// field never overwrites a stored value with "".
			const updated = await updateMyProfile({
				full_name: form.full_name.trim() || undefined,
				dob: form.dob || undefined,
				gender: form.gender.trim() || undefined,
				blood_group: form.blood_group.trim() || undefined,
				address: {
					street: form.street.trim() || undefined,
					city: form.city.trim() || undefined,
					state: form.state.trim() || undefined,
					pincode: form.pincode.trim() || undefined,
				},
			});
			hydrate(updated);
			setMessage("Profile updated successfully.");
			setEditing(false);
		} catch (requestError) {
			setError(apiErrorMessage(requestError));
		} finally {
			setSaving(false);
		}
	}

	if (loading) return <div className="loading-state">Loading your profile...</div>;

	const displayName = profile?.full_name ?? user.full_name;

	return (
		<section className="view-stack">
			<div className="section-heading">
				<div><p className="eyebrow">Profile</p><h2>Your details</h2></div>
			</div>

			<div className="profile-card">
				<div className="profile-avatar">{displayName.charAt(0)}</div>
				<div>
					<h3>{displayName}</h3>
					<p>{profile?.email ?? "No email added"}</p>
					<span className="role-chip">{roleLabels[user.role]}</span>
				</div>
				<button className="outline-button compact-button" onClick={() => { setEditing(!editing); setMessage(""); setError(""); }}>
					{editing ? "Close" : "Edit profile"}
				</button>
			</div>

			{message && <div className="profile-message">{message}</div>}
			{error && <div className="error-message">{error}</div>}

			{editing ? (
				<div className="profile-form">
					<div className="field">
						<label>Full name</label>
						<input value={form.full_name} onChange={change("full_name")} />
					</div>
					<div className="field">
						<label>Phone <span className="optional-label">cannot be changed</span></label>
						<input value={profile?.phone ?? user.phone} disabled />
					</div>
					<div className="field">
						<label>Email <span className="optional-label">cannot be changed</span></label>
						<input type="email" value={profile?.email ?? ""} disabled />
					</div>
					<div className="profile-form-grid">
						<div className="field"><label>Date of birth</label><input type="date" value={form.dob} onChange={change("dob")} /></div>
						<div className="field"><label>Gender</label><input value={form.gender} onChange={change("gender")} placeholder="Not specified" /></div>
						<div className="field"><label>Blood group</label><input value={form.blood_group} onChange={change("blood_group")} placeholder="e.g. B+" /></div>
						<div className="field"><label>Street</label><input value={form.street} onChange={change("street")} /></div>
						<div className="field"><label>City</label><input value={form.city} onChange={change("city")} /></div>
						<div className="field"><label>State</label><input value={form.state} onChange={change("state")} /></div>
						<div className="field"><label>Pincode</label><input value={form.pincode} onChange={change("pincode")} /></div>
					</div>
					<button className="primary-action" onClick={save} disabled={saving}>
						{saving ? "Saving..." : "Save changes"}
					</button>
				</div>
			) : (
				<div className="detail-list">
					<Detail label="Phone" value={profile?.phone ?? user.phone} />
					<Detail label="Email" value={profile?.email ?? "Not added"} />
					<Detail label="Date of birth" value={dateLabel(profile?.profile?.dob)} />
					<Detail label="Gender" value={profile?.profile?.gender ?? "Not added"} />
					<Detail label="Blood group" value={profile?.profile?.blood_group ?? "Not added"} />
					<Detail
						label="Address"
						value={[profile?.profile?.address?.street, profile?.profile?.address?.city, profile?.profile?.address?.state, profile?.profile?.address?.pincode].filter(Boolean).join(", ") || "Not added"}
					/>
					<Detail label="Role" value={roleLabels[user.role]} />
					<Detail label="With the gym since" value={dateLabel(profile?.gym_meta?.joined_on)} />
				</div>
			)}
		</section>
	);
}

function Detail({ label, value }: { label: string; value: string }) {
	return (
		<div className="detail-row">
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	);
}

/* ── Admin: member directory ─────────────────────────────────────────────── */

/**
 * Every gym member, with a headline count and search.
 *
 * Opening a row shows that member's profile rather than navigating away, so
 * returning to the list keeps the search term.
 */
function MemberDirectory({ onOpenMember }: { onOpenMember: (id: string) => void }) {
	const [audience, setAudience] = useState<"members" | "trainers">("members");
	const [members, setMembers] = useState<MemberListItem[]>([]);
	const [trainers, setTrainers] = useState<TrainerListItem[]>([]);
	const [today, setToday] = useState<TodayCheckIn[]>([]);
	const [total, setTotal] = useState(0);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [markingId, setMarkingId] = useState<string | null>(null);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	const load = useCallback(async (term: string) => {
		setLoading(true);
		try {
			// Today's check-ins drive the per-row attendance state.
			const [result, trainerList, todayList] = await Promise.all([
				listMembers({ search: term, role: "member", limit: 100 }),
				listTrainers(),
				getTodayCheckIns(),
			]);
			setMembers(result.items);
			setTotal(result.meta.total);
			setTrainers(trainerList);
			setToday(todayList);
			setError("");
		} catch (requestError) {
			setError(apiErrorMessage(requestError));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { void load(""); }, [load]);

	// Debounced so typing does not fire a request per keystroke.
	useEffect(() => {
		const timer = window.setTimeout(() => { void load(search.trim()); }, 350);
		return () => window.clearTimeout(timer);
	}, [search, load]);

	const activeCount = members.filter((m) => m.gym_meta.membership_status === "active").length;
	const checkedInIds = useMemo(() => new Set(today.map((item) => item.member.id)), [today]);
	const showingTrainers = audience === "trainers";

	// Trainers are filtered here rather than server-side; the list is small and
	// the endpoint takes no search parameter.
	const visibleTrainers = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return trainers;
		return trainers.filter(
			(t) => t.full_name.toLowerCase().includes(term) || t.phone.includes(term),
		);
	}, [trainers, search]);

	async function mark(member: MemberListItem) {
		setMarkingId(member.id); setError(""); setNotice("");
		try {
			const result = await markAttendance(member.id);
			setNotice(result.message ?? `Attendance marked for ${member.full_name}.`);
			setToday(await getTodayCheckIns());
		} catch (requestError) {
			// Covers no active plan, expired plan and exhausted quota.
			setError(apiErrorMessage(requestError));
		} finally {
			setMarkingId(null);
		}
	}

	return (
		<section className="view-stack">
			<nav className="section-jump" aria-label="Choose directory">
				<button
					className={showingTrainers ? "jump-pill" : "jump-pill active"}
					aria-current={showingTrainers ? undefined : "true"}
					onClick={() => setAudience("members")}
				>
					Gym users
				</button>
				<button
					className={showingTrainers ? "jump-pill active" : "jump-pill"}
					aria-current={showingTrainers ? "true" : undefined}
					onClick={() => setAudience("trainers")}
				>
					Trainers
				</button>
			</nav>

			<div className="insight-grid">
				<article className="insight-card accent-card">
					<Users size={19} />
					<strong>{showingTrainers ? trainers.length : total}</strong>
					<span>{showingTrainers ? "trainers" : "gym users"}</span>
				</article>
				{!showingTrainers && (
					<article className="insight-card">
						<CalendarCheck size={19} /><strong>{activeCount}</strong><span>active now</span>
					</article>
				)}
			</div>

			<div className="search-row">
				<Search size={16} />
				<input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder={showingTrainers ? "Search trainers" : "Search by name or phone"}
					aria-label="Search directory"
				/>
			</div>

			{error && <div className="error-message">{error}</div>}
			{notice && <div className="profile-message">{notice}</div>}

			{loading ? (
				<div className="loading-state">Loading directory...</div>
			) : showingTrainers ? (
				visibleTrainers.length === 0 ? (
					<div className="empty-state">No trainers matched your search.</div>
				) : (
					<div className="table-wrap">
						<table className="data-table">
							<thead>
								<tr><th>ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Status</th></tr>
							</thead>
							<tbody>
								{visibleTrainers.map((trainer) => (
									<tr
										key={trainer.id}
										className="row-clickable"
										onClick={() => onOpenMember(trainer.id)}
										onKeyDown={(event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault();
												onOpenMember(trainer.id);
											}
										}}
										tabIndex={0}
										role="button"
										aria-label={`Open ${trainer.full_name}`}
									>
										<td data-label="ID"><code className="row-id">{shortId(trainer.id)}</code></td>
										<td data-label="Name"><strong>{trainer.full_name}</strong></td>
										<td data-label="Phone">{trainer.phone}</td>
										<td data-label="Email">{trainer.email ?? "—"}</td>
										<td data-label="Status">
											<span className={trainer.is_active ? "status-dot" : "muted"}>
												{trainer.is_active ? "Active" : "Inactive"}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)
			) : members.length === 0 ? (
				<div className="empty-state">No gym users matched your search.</div>
			) : (
				<div className="table-wrap">
					<table className="data-table">
						<thead>
							<tr><th>ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Attendance</th></tr>
						</thead>
						<tbody>
							{members.map((member) => {
								const done = checkedInIds.has(member.id);
								return (
									// The row opens the profile; the attendance cell stops the
									// click so marking present never navigates away.
									<tr
										key={member.id}
										className="row-clickable"
										onClick={() => onOpenMember(member.id)}
										onKeyDown={(event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault();
												onOpenMember(member.id);
											}
										}}
										tabIndex={0}
										role="button"
										aria-label={`Open ${member.full_name}`}
									>
										<td data-label="ID"><code className="row-id">{shortId(member.id)}</code></td>
										<td data-label="Name"><strong>{member.full_name}</strong></td>
										<td data-label="Phone">{member.phone}</td>
										<td data-label="Email">{member.email ?? "—"}</td>
										<td data-label="Attendance" onClick={(event) => event.stopPropagation()}>
											{done ? (
												<span className="status-dot">Present today</span>
											) : (
												<button
													className="outline-button compact-button"
													onClick={() => mark(member)}
													disabled={markingId === member.id}
												>
													{markingId === member.id ? "Marking..." : "Mark attendance"}
												</button>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}

/* ── Admin: one member's profile ─────────────────────────────────────────── */

/**
 * A member's details, plan and attendance, with the option to mark them
 * present. Marking refreshes the record in place so the change is visible
 * without a reload.
 */
function MemberDetail({ memberId, onBack }: { memberId: string; onBack: () => void }) {
	const [member, setMember] = useState<MemberProfile | null>(null);
	const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
	const [subscription, setSubscription] = useState<Subscription | null>(null);
	const [loading, setLoading] = useState(true);
	const [marking, setMarking] = useState(false);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const profile = await getUserById(memberId);
			setMember(profile);
			// allSettled: a member with no plan should still show their profile.
			const [log, sub] = await Promise.allSettled([
				getMemberAttendance(memberId),
				// Looked up by member rather than by the profile's cached
				// active_subscription_id, which can drift out of step with the
				// subscription's real status.
				getActiveSubscriptionForMember(memberId),
			]);
			if (log.status === "fulfilled") setAttendance(log.value);
			if (sub.status === "fulfilled") setSubscription(sub.value);
			setError("");
		} catch (requestError) {
			setError(apiErrorMessage(requestError));
		} finally {
			setLoading(false);
		}
	}, [memberId]);

	useEffect(() => { void load(); }, [load]);

	const todayKey = new Date().toISOString().slice(0, 10);
	const presentToday = attendance.some((entry) => entry.date === todayKey);
	// Staff have no plan, so check-in and plan facts do not apply to them.
	const isStaff = member?.role === "trainer" || member?.role === "owner";

	async function mark() {
		setMarking(true); setError(""); setNotice("");
		try {
			const result = await markAttendance(memberId);
			setNotice(result.message ?? "Attendance marked.");
			await load();
		} catch (requestError) {
			// Covers no active plan, expired plan and exhausted quota.
			setError(apiErrorMessage(requestError));
		} finally {
			setMarking(false);
		}
	}

	if (loading) return <div className="loading-state">Loading member...</div>;
	if (!member) return <div className="empty-state">{error || "Member not found."}</div>;

	return (
		<section className="view-stack">
			<button className="back-button" onClick={onBack}><ChevronLeft size={16} /> Back to members</button>

			<div className="profile-card">
				<div className="profile-avatar">{member.full_name.charAt(0)}</div>
				<div>
					<h3>{member.full_name}</h3>
					<p>{member.phone}{member.email ? ` · ${member.email}` : ""}</p>
					<span className={member.gym_meta?.membership_status === "active" ? "status-dot" : "muted"}>
						{member.gym_meta?.membership_status ?? "inactive"}
					</span>
				</div>
				{/* The backend refuses check-in for staff (NO_ACTIVE_SUBSCRIPTION),
				    so offering the button here would be a control that always fails. */}
				{isStaff ? (
					<span className="role-chip">{member.role === "owner" ? "Admin" : "Trainer"}</span>
				) : (
					<button className="primary-action compact-button" onClick={mark} disabled={marking || presentToday}>
						{marking ? "Marking..." : presentToday ? "Present today" : "Mark attendance"}
					</button>
				)}
			</div>

			{notice && <div className="profile-message">{notice}</div>}
			{error && <div className="error-message">{error}</div>}

			{!isStaff && (
				<div className="insight-grid">
					<article className="insight-card accent-card">
						<CalendarCheck size={19} /><strong>{attendance.length}</strong><span>total visits</span>
					</article>
					<article className="insight-card">
						<Clock size={19} /><strong>{subscription?.days_remaining ?? 0}</strong><span>visits left</span>
					</article>
				</div>
			)}

			<div className="section-heading"><h2>Details</h2></div>
			<div className="detail-list">
				<Detail label="Phone" value={member.phone} />
				<Detail label="Email" value={member.email ?? "Not added"} />
				<Detail label="Joined" value={dateLabel(member.gym_meta?.joined_on)} />
				<Detail label="Blood group" value={member.profile?.blood_group ?? "Not added"} />
				<Detail label="Address" value={[member.profile?.address?.city, member.profile?.address?.state].filter(Boolean).join(", ") || "Not added"} />
				{!isStaff && <Detail label="Current plan" value={subscription?.plan_snapshot.plan_name ?? "No active plan"} />}
				{!isStaff && subscription && <Detail label="Expires" value={dateLabel(subscription.expires_on)} />}
				<Detail label="Record ID" value={shortId(memberId)} />
			</div>

			{!isStaff && (
				<div className="member-split">
					<MemberAttendanceCalendar attendance={attendance} />
					<MemberPlanPanel subscription={subscription} attendanceCount={attendance.length} />
				</div>
			)}
		</section>
	);
}

/* ── Staff: attendance recorder ──────────────────────────────────────────── */

/**
 * The front-desk flow: search, then mark present in one tap without leaving
 * the list. The member profile has the same action for when staff are already
 * looking at that person.
 */
/**
 * Short, stable identifier shown in the directory and attendance tables.
 *
 * Mongo ids are 24 hex characters — unreadable in a table. The last six are
 * enough to tell apart two members who share a name, which is the job, and
 * they stay stable for the life of the record.
 */
function shortId(id: string) {
	return id.slice(-6).toUpperCase();
}

/**
 * Attendance: mark gym users present, and see which trainers are on today.
 *
 * Trainers are read-only here. Member check-in deducts a day from a plan
 * quota, and staff have no plan, so the backend refuses it — offering the
 * button would be a control that always fails.
 */
function AttendanceRecorder({ isAdmin }: { isAdmin: boolean }) {
	const [audience, setAudience] = useState<"members" | "trainers">("members");
	const [members, setMembers] = useState<MemberListItem[]>([]);
	const [trainers, setTrainers] = useState<TrainerListItem[]>([]);
	const [today, setToday] = useState<TodayCheckIn[]>([]);
	const [summary, setSummary] = useState<TrainerDashboard | null>(null);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [markingId, setMarkingId] = useState<string | null>(null);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	const load = useCallback(async (term: string) => {
		setLoading(true);
		const [memberResult, todayResult, summaryResult, trainerResult] = await Promise.allSettled([
			listMembers({ search: term, role: "member", limit: 100 }),
			getTodayCheckIns(),
			getTrainerDashboard(),
			// Only admins may list trainers; a trainer's own call would 403.
			isAdmin ? listTrainers() : Promise.resolve([] as TrainerListItem[]),
		]);
		if (memberResult.status === "fulfilled") { setMembers(memberResult.value.items); setError(""); }
		else setError(apiErrorMessage(memberResult.reason));
		if (todayResult.status === "fulfilled") setToday(todayResult.value);
		if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
		if (trainerResult.status === "fulfilled") setTrainers(trainerResult.value);
		setLoading(false);
	}, [isAdmin]);

	useEffect(() => { void load(""); }, [load]);
	useEffect(() => {
		const timer = window.setTimeout(() => { void load(search.trim()); }, 350);
		return () => window.clearTimeout(timer);
	}, [search, load]);

	const checkedInIds = useMemo(() => new Set(today.map((item) => item.member.id)), [today]);
	const showingTrainers = audience === "trainers";

	const visibleTrainers = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return trainers;
		return trainers.filter(
			(t) => t.full_name.toLowerCase().includes(term) || t.phone.includes(term),
		);
	}, [trainers, search]);

	async function mark(member: MemberListItem) {
		setMarkingId(member.id); setError(""); setNotice("");
		try {
			const result = await markAttendance(member.id);
			setNotice(result.message ?? `Attendance marked for ${member.full_name}.`);
			const [refreshedToday, refreshedSummary] = await Promise.allSettled([
				getTodayCheckIns(),
				getTrainerDashboard(),
			]);
			if (refreshedToday.status === "fulfilled") setToday(refreshedToday.value);
			if (refreshedSummary.status === "fulfilled") setSummary(refreshedSummary.value);
		} catch (requestError) {
			// Covers no active plan, expired plan and exhausted quota.
			setError(apiErrorMessage(requestError));
		} finally {
			setMarkingId(null);
		}
	}

	return (
		<section className="view-stack">
			{isAdmin && (
				<nav className="section-jump" aria-label="Choose who to record">
					<button
						className={showingTrainers ? "jump-pill" : "jump-pill active"}
						aria-current={showingTrainers ? undefined : "true"}
						onClick={() => setAudience("members")}
					>
						Gym users
					</button>
					<button
						className={showingTrainers ? "jump-pill active" : "jump-pill"}
						aria-current={showingTrainers ? "true" : undefined}
						onClick={() => setAudience("trainers")}
					>
						Trainers
					</button>
				</nav>
			)}

			{summary && !showingTrainers && (
				<div className="insight-grid">
					<article className="insight-card accent-card">
						<CalendarCheck size={19} /><strong>{summary.checkins_today}</strong><span>checked in today</span>
					</article>
					<article className="insight-card">
						<Clock size={19} /><strong>{summary.expiring_soon_count}</strong><span>renewals due this week</span>
					</article>
				</div>
			)}

			<div className="search-row">
				<Search size={16} />
				<input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder={showingTrainers ? "Search trainers" : "Search by name or phone"}
					aria-label="Search"
				/>
			</div>

			{error && <div className="error-message">{error}</div>}
			{notice && <div className="profile-message">{notice}</div>}

			{loading ? (
				<div className="loading-state">Loading...</div>
			) : showingTrainers ? (
				visibleTrainers.length === 0 ? (
					<div className="empty-state">No trainers matched your search.</div>
				) : (
					<>
						<div className="table-wrap">
							<table className="data-table">
								<thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Status</th></tr></thead>
								<tbody>
									{visibleTrainers.map((trainer) => (
										<tr key={trainer.id}>
											<td data-label="ID"><code className="row-id">{shortId(trainer.id)}</code></td>
											<td data-label="Name"><strong>{trainer.full_name}</strong></td>
											<td data-label="Email">{trainer.email ?? "—"}</td>
											<td data-label="Status">
												<span className={trainer.is_active ? "status-dot" : "muted"}>
													{trainer.is_active ? "Active" : "Inactive"}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<p className="muted catalogue-note">
							Trainer shifts are not tracked as gym attendance — check-in draws down a
							member plan, which staff accounts do not have.
						</p>
					</>
				)
			) : members.length === 0 ? (
				<div className="empty-state">No gym users matched your search.</div>
			) : (
				<div className="table-wrap">
					<table className="data-table">
						<thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Attendance</th></tr></thead>
						<tbody>
							{members.map((member) => {
								const done = checkedInIds.has(member.id);
								return (
									<tr key={member.id}>
										<td data-label="ID"><code className="row-id">{shortId(member.id)}</code></td>
										<td data-label="Name"><strong>{member.full_name}</strong></td>
										<td data-label="Email">{member.email ?? "—"}</td>
										<td data-label="Attendance">
											{done ? (
												<span className="status-dot">Present today</span>
											) : (
												<button
													className="outline-button compact-button"
													onClick={() => mark(member)}
													disabled={markingId === member.id}
												>
													{markingId === member.id ? "Marking..." : "Mark attendance"}
												</button>
											)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}

/* ── Shared: section jump navigation ─────────────────────────────────────── */

/**
 * Pills that scroll to a section and track which one is in view.
 *
 * Same behaviour as the member pages, extracted so the plan and coupon
 * managers share it rather than each growing their own copy.
 */
function useSectionJump(sections: { id: string; label: string }[]) {
	const [activeSection, setActiveSection] = useState(sections[0]?.id ?? "");
	const jumpingRef = useRef(false);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (jumpingRef.current) return;
				const visible = entries
					.filter((entry) => entry.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
				if (visible) setActiveSection(visible.target.id);
			},
			{ rootMargin: "-120px 0px -55% 0px", threshold: 0 },
		);
		for (const section of sections) {
			const element = document.getElementById(section.id);
			if (element) observer.observe(element);
		}

		// The last section can be too short to enter the band above, which
		// would strand the previous pill.
		function handleScroll() {
			if (jumpingRef.current) return;
			const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 2;
			const last = sections[sections.length - 1];
			if (atBottom && last) setActiveSection(last.id);
		}
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => {
			observer.disconnect();
			window.removeEventListener("scroll", handleScroll);
		};
	}, [sections]);

	function jumpTo(id: string) {
		setActiveSection(id);
		jumpingRef.current = true;
		document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
		window.setTimeout(() => { jumpingRef.current = false; }, 700);
	}

	return { activeSection, jumpTo };
}

function SectionJump({ sections, activeSection, onJump }: { sections: { id: string; label: string }[]; activeSection: string; onJump: (id: string) => void }) {
	return (
		<nav className="section-jump" aria-label="Jump to section">
			{sections.map((section) => (
				<button
					key={section.id}
					className={activeSection === section.id ? "jump-pill active" : "jump-pill"}
					aria-current={activeSection === section.id ? "true" : undefined}
					onClick={() => onJump(section.id)}
				>
					{section.label}
				</button>
			))}
		</nav>
	);
}

/* ── Admin: analytics ────────────────────────────────────────────────────── */

/**
 * Membership and plan analytics, split into two jump sections.
 *
 * The per-plan chart is a horizontal bar: the job is comparing magnitude
 * across long plan names, so bars run horizontally and colour is sequential
 * (one hue, more-is-darker) rather than categorical — the plans are not
 * identities to tell apart, they are quantities to rank.
 */
function AnalyticsView() {
	const [data, setData] = useState<Analytics | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	// Which figure's members are open below the list, if any.
	const [cohort, setCohort] = useState<MemberCohort | null>(null);

	const sections = useMemo(
		() => [
			{ id: "member-analytics", label: "Members" },
			{ id: "plan-analytics", label: "Plans" },
		],
		[],
	);
	const { activeSection, jumpTo } = useSectionJump(sections);

	useEffect(() => {
		let cancelled = false;
		getAnalytics()
			.then((result) => { if (!cancelled) { setData(result); setError(""); } })
			.catch((requestError) => { if (!cancelled) setError(apiErrorMessage(requestError)); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, []);

	if (loading) return <div className="loading-state">Loading analytics...</div>;
	if (error || !data) return <div className="empty-state">{error || "Analytics are not available."}</div>;

	const { members, plans } = data;

	return (
		<section className="view-stack">
			<SectionJump sections={sections} activeSection={activeSection} onJump={jumpTo} />

			{/* ── Membership ── */}
			<div id="member-analytics" className="jump-target">
				<div className="section-heading">
					<div><p className="eyebrow">Analytics</p><h2>Membership</h2></div>
				</div>

				<div className="insight-grid">
					<article className="insight-card accent-card">
						<Users size={19} /><strong>{members.total_registered}</strong><span>total registered</span>
					</article>
					<button className="insight-card insight-card-button" onClick={() => setCohort("active")}>
						<CalendarCheck size={19} /><strong>{members.active}</strong><span>active members</span>
					</button>
					<button className="insight-card insight-card-button" onClick={() => setCohort("inactive")}>
						<Clock size={19} /><strong>{members.inactive}</strong><span>inactive</span>
					</button>
				</div>

				{/* Each row opens the members it counts, so a figure can be acted
				    on rather than only read. */}
				<div className="detail-list">
					<CohortRow label="Lapsed — bought before, not renewed" count={members.lapsed} cohort="lapsed" onOpen={setCohort} active={cohort === "lapsed"} />
					<CohortRow label="Never bought a plan" count={members.never_subscribed} cohort="never_subscribed" onOpen={setCohort} active={cohort === "never_subscribed"} />
					<CohortRow label="Suspended accounts" count={members.suspended} cohort="suspended" onOpen={setCohort} active={cohort === "suspended"} />
					<CohortRow label="Joined this month" count={members.joined_this_month} cohort="joined_this_month" onOpen={setCohort} active={cohort === "joined_this_month"} />
				</div>

				{cohort && <CohortTable cohort={cohort} onClose={() => setCohort(null)} />}

				{members.lapsed > 0 && (
					<p className="muted analytics-note">
						{members.lapsed} {members.lapsed === 1 ? "member has" : "members have"} let a plan expire without
						renewing — worth a follow-up.
					</p>
				)}
			</div>

			{/* ── Plans ── */}
			<div id="plan-analytics" className="jump-target">
				<div className="section-heading">
					<div><p className="eyebrow">Analytics</p><h2>Plans</h2></div>
				</div>

				<div className="insight-grid">
					<article className="insight-card accent-card">
						<LayoutGrid size={19} /><strong>{plans.total_plans}</strong><span>total plans</span>
					</article>
					<article className="insight-card">
						<CalendarCheck size={19} /><strong>{plans.active_plans}</strong><span>active</span>
					</article>
					<article className="insight-card">
						<Clock size={19} /><strong>{plans.inactive_plans}</strong><span>inactive</span>
					</article>
				</div>

				<div className="detail-list">
					<Detail
						label="Most bought"
						value={plans.most_bought ? `${plans.most_bought.plan_name} · ${plans.most_bought.total_sold} sold` : "No sales yet"}
					/>
					<Detail
						label="Least bought"
						value={plans.least_bought ? `${plans.least_bought.plan_name} · ${plans.least_bought.total_sold} sold` : "Not enough data"}
					/>
				</div>

				<PlanMembersChart breakdown={plans.breakdown} />
			</div>
		</section>
	);
}

/**
 * Members per plan.
 *
 * Inline SVG so it needs no charting dependency and inherits the theme.
 * Bars are capped at 22px with a 4px rounded data-end, squared at the
 * baseline; the axis is a single hairline. Colour is one hue at varying
 * opacity — magnitude, not identity.
 */
function PlanMembersChart({ breakdown }: { breakdown: PlanBreakdownItem[] }) {
	// Plans nobody is on would render as a row of empty labels.
	const rows = breakdown.filter((item) => item.active_members > 0 || item.total_sold > 0);
	const peak = Math.max(1, ...rows.map((item) => item.active_members));

	// A rounded axis maximum with whole-number ticks, so the bars are read
	// against a scale rather than against each other. Without it, several
	// plans tied at the top all fill the track and the chart says nothing.
	const axisMax = peak <= 4 ? peak + 1 : Math.ceil((peak * 1.1) / 2) * 2;
	const tickCount = Math.min(axisMax, 5);
	const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
		Math.round((axisMax / tickCount) * i),
	).filter((value, index, all) => all.indexOf(value) === index);

	if (rows.length === 0) {
		return (
			<>
				<div className="section-heading"><h3>Members per plan</h3></div>
				<div className="empty-state">No plans have been sold yet.</div>
			</>
		);
	}

	return (
		<>
			<div className="section-heading"><h3>Members per plan</h3></div>

			<div className="chart-panel">
				<div className="chart-plot">
					{/* Hairline grid, one step off the surface — recessive, so the
					    bars stay the loudest thing in the panel. */}
					<div className="chart-grid" aria-hidden="true">
						<span />
						<span className="chart-grid-track">
							<span className="chart-grid-inner">
								{ticks.map((tick) => (
									<span
										className="chart-gridline"
										key={tick}
										style={{ left: `${(tick / axisMax) * 100}%` }}
									/>
								))}
							</span>
						</span>
					</div>

					<div className="chart-rows">
						{rows.map((item) => (
							<div className="chart-row" key={item.plan_id}>
								<span className="chart-label" title={item.plan_name}>
									{item.plan_name}
									{!item.is_active && <em className="chart-archived"> archived</em>}
								</span>
								<span className="chart-track">
									{/* Thin mark rather than a thick saturated block, with the
									    value sitting just past the end instead of inside it. */}
									<span
										className="chart-bar"
										style={{ width: `${(item.active_members / axisMax) * 100}%` }}
									/>
									<span className="chart-mark-value">{item.active_members}</span>
								</span>
							</div>
						))}
					</div>
				</div>

				{/* Axis band, inside the panel so it is never cropped out. */}
				<div className="chart-axis" aria-hidden="true">
					<span className="chart-label" />
					<span className="chart-axis-track">
						{/* Inner element matches the bar track's measured width, so a
						    tick sits exactly under the value it marks. */}
						<span className="chart-axis-inner">
							{ticks.map((tick) => (
								<span
									className="chart-tick"
									key={tick}
									style={{ left: `${(tick / axisMax) * 100}%` }}
								>
									{tick}
								</span>
							))}
						</span>
					</span>
				</div>
				<p className="chart-axis-caption">members currently on each plan</p>
			</div>

			{/* A table view, so the figures are readable without the bars. */}
			<details className="chart-table">
				<summary>View as table</summary>
				<div className="detail-list">
					{rows.map((item) => (
						<Detail
							key={item.plan_id}
							label={item.plan_name}
							value={`${item.active_members} members · ${item.total_sold} sold · ${money(item.revenue_paise)}`}
						/>
					))}
				</div>
			</details>
		</>
	);
}
/* ── Admin: member attendance calendar ───────────────────────────────────── */

const MONTH_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** Local YYYY-MM-DD, so "today" matches the viewer's calendar rather than UTC. */
function localDayKey(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * A member's visits as a month grid.
 *
 * Replaces the day-by-day list, which grew unreadable past a few weeks and
 * made patterns — a gap, a streak — impossible to see. Opens on the current
 * month; the arrows step back through history.
 */
function MemberAttendanceCalendar({ attendance }: { attendance: AttendanceRecord[] }) {
	const today = new Date();
	const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

	const attendedDays = useMemo(
		() => new Set(attendance.map((entry) => entry.date)),
		[attendance],
	);

	const year = cursor.getFullYear();
	const month = cursor.getMonth();

	const cells = useMemo(() => {
		const firstWeekday = new Date(year, month, 1).getDay();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		// Leading blanks so the 1st lands under its weekday column.
		return [
			...Array.from({ length: firstWeekday }, () => null),
			...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
		];
	}, [year, month]);

	const monthLabel = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
	const visitsThisMonth = cells.filter((date) => date && attendedDays.has(localDayKey(date))).length;
	const atCurrentMonth = year === today.getFullYear() && month === today.getMonth();

	return (
		<article className="panel calendar-panel">
			<div className="panel-head">
				<p className="eyebrow">Attendance</p>
				<div className="calendar-nav">
					<button
						className="icon-button compact-icon"
						onClick={() => setCursor(new Date(year, month - 1, 1))}
						aria-label="Previous month"
					>
						<ChevronLeft size={16} />
					</button>
					<button
						className="icon-button compact-icon"
						onClick={() => setCursor(new Date(year, month + 1, 1))}
						disabled={atCurrentMonth}
						aria-label="Next month"
					>
						<ChevronRight size={16} />
					</button>
				</div>
			</div>

			<h3 className="calendar-month">{monthLabel}</h3>

			<div className="calendar-grid" role="grid" aria-label={`Attendance for ${monthLabel}`}>
				{MONTH_WEEKDAYS.map((initial, index) => (
					<span className="calendar-weekday" key={`${initial}-${index}`} aria-hidden="true">{initial}</span>
				))}
				{cells.map((date, index) => {
					if (!date) return <span className="calendar-cell empty" key={`blank-${index}`} />;
					const key = localDayKey(date);
					const attended = attendedDays.has(key);
					const isToday = key === localDayKey(today);
					const isFuture = date > today;
					return (
						<span
							key={key}
							className={`calendar-cell${attended ? " attended" : ""}${isToday ? " is-today" : ""}${isFuture ? " future" : ""}`}
							title={attended ? `Visited on ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : undefined}
						>
							{date.getDate()}
						</span>
					);
				})}
			</div>

			<p className="muted calendar-summary">
				<span className="calendar-key" aria-hidden="true" /> {visitsThisMonth} {visitsThisMonth === 1 ? "visit" : "visits"} this month
			</p>
		</article>
	);
}

/* ── Admin: member's current plan ────────────────────────────────────────── */

/**
 * The member's active plan, alongside the calendar.
 *
 * Shows what they bought and how much of it is left — the two questions an
 * admin looking at a member is usually answering.
 */
function MemberPlanPanel({ subscription, attendanceCount }: { subscription: Subscription | null; attendanceCount: number }) {
	if (!subscription) {
		return (
			<article className="panel plan-panel">
				<div className="panel-head"><p className="eyebrow">Current plan</p></div>
				<div className="panel-empty">
					<p>No active plan.</p>
					<small className="muted">{attendanceCount} lifetime {attendanceCount === 1 ? "visit" : "visits"} recorded.</small>
				</div>
			</article>
		);
	}

	const usedPercent = Math.min(
		100,
		Math.round((subscription.days_used / subscription.allocated_days) * 100),
	);

	return (
		<article className="panel plan-panel">
			<div className="panel-head">
				<p className="eyebrow">Current plan</p>
				<span className="status-dot">{subscription.status}</span>
			</div>

			<div className="plan-panel-ring">
				<div
					className="progress-ring"
					style={{ "--progress": `${usedPercent * 3.6}deg` } as React.CSSProperties}
				>
					<span>{subscription.days_remaining}<small>left</small></span>
				</div>
				<div className="plan-panel-head">
					<h2 className="plan-panel-name">{subscription.plan_snapshot.plan_name}</h2>
					<p className="muted">{subscription.plan_snapshot.calendar_days} days · {subscription.allocated_days} visits</p>
					<strong className="plan-panel-price">{money(subscription.plan_snapshot.price_paise)}</strong>
				</div>
			</div>

			<div className="plan-progress">
				<div className="plan-progress-track">
					<div className="plan-progress-fill" style={{ width: `${usedPercent}%` }} />
				</div>
				<div className="plan-progress-labels">
					<span>{subscription.days_used} of {subscription.allocated_days} visits used</span>
					<span>{usedPercent}%</span>
				</div>
			</div>

			<dl className="plan-facts">
				<div><dt>Started</dt><dd>{dateLabel(subscription.starts_on)}</dd></div>
				<div><dt>Expires</dt><dd>{dateLabel(subscription.expires_on)}</dd></div>
				<div><dt>Days to renew</dt><dd>{subscription.days_until_expiry}</dd></div>
			</dl>
		</article>
	);
}

/* ── Admin: analytics drill-down ─────────────────────────────────────────── */

/**
 * One analytics figure, clickable to reveal the members it counts.
 *
 * A zero row stays clickable and opens an empty state. Making it inert
 * instead left no way to tell "nobody is in this group" from "this row is
 * broken", and an inconsistently interactive list is harder to scan.
 */
function CohortRow({ label, count, cohort, onOpen, active }: { label: string; count: number; cohort: MemberCohort; onOpen: (c: MemberCohort | null) => void; active: boolean }) {
	return (
		<button
			className={active ? "detail-row cohort-row open" : "detail-row cohort-row"}
			onClick={() => onOpen(active ? null : cohort)}
			aria-expanded={active}
		>
			<span>{label}</span>
			<span className="cohort-row-right">
				<strong>{count}</strong>
				<ChevronRight size={15} className={active ? "cohort-chevron open" : "cohort-chevron"} />
			</span>
		</button>
	);
}

/** The members behind a figure, loaded when the row is opened. */
function CohortTable({ cohort, onClose }: { cohort: MemberCohort; onClose: () => void }) {
	const [members, setMembers] = useState<CohortMember[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		getMemberCohort(cohort)
			.then((result) => { if (!cancelled) { setMembers(result); setError(""); } })
			.catch((requestError) => { if (!cancelled) setError(apiErrorMessage(requestError)); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [cohort]);

	return (
		<div className="cohort-panel">
			<div className="cohort-panel-head">
				<strong>{COHORT_LABELS[cohort]}</strong>
				<button className="text-button" onClick={onClose}>Close</button>
			</div>

			{error && <div className="error-message">{error}</div>}

			{loading ? (
				<div className="loading-state">Loading members...</div>
			) : members.length === 0 ? (
				<div className="empty-state">{COHORT_EMPTY[cohort]}</div>
			) : (
				<div className="table-wrap">
					<table className="data-table">
						<thead><tr><th>ID</th><th>Name</th><th>Phone</th><th>Email</th><th>Joined</th></tr></thead>
						<tbody>
							{members.map((member) => (
								<tr key={member.id}>
									<td data-label="ID"><code className="row-id">{shortId(member.id)}</code></td>
									<td data-label="Name"><strong>{member.full_name}</strong></td>
									<td data-label="Phone">{member.phone}</td>
									<td data-label="Email">{member.email ?? "—"}</td>
									<td data-label="Joined">{dateLabel(member.gym_meta.joined_on)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

/** Why a group is empty, which is more useful than "no members". */
const COHORT_EMPTY: Record<MemberCohort, string> = {
	active: "No members have an active plan right now.",
	inactive: "No members are inactive — everyone holds a live plan.",
	lapsed: "Nobody has let a plan expire without renewing.",
	never_subscribed: "Every member has bought at least one plan.",
	suspended: "No accounts are suspended.",
	joined_this_month: "No members joined this month.",
};

const COHORT_LABELS: Record<MemberCohort, string> = {
	active: "Active members",
	inactive: "Inactive members",
	lapsed: "Lapsed — bought before, not renewed",
	never_subscribed: "Never bought a plan",
	suspended: "Suspended accounts",
	joined_this_month: "Joined this month",
};
