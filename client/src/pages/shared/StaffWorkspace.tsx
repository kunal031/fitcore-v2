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
	updateMyProfile,
	type MemberListItem,
} from "../../services/userService";
import { getSubscriptionById, type Subscription } from "../../services/subscriptionService";
import { getAnalytics, type Analytics, type PlanBreakdownItem } from "../../services/analyticsService";
import { useTabRoute } from "../../hooks/useTabRoute";
import { roleLabels } from "../../router/routes";
import type { AuthUser, MemberProfile } from "../../store/authStore";

/**
 * Admin sees plan and coupon management plus the member list.
 * Trainer sees three tabs: attendance, a read-only catalogue, and their profile.
 */
const STAFF_TABS = ["members", "record", "plans", "coupons", "analytics", "catalogue", "profile"] as const;
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
	// Admins land on Members; the logo returns here.
	const homeTab: StaffTab = "members";
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
						["members", Users, "Members"],
						["record", CalendarCheck, "Record"],
						["plans", LayoutGrid, "Plans"],
						["coupons", BadgePercent, "Coupons"],
						["analytics", ChartBar, "Analytics"],
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
					{tab === "record" && <AttendanceRecorder />}
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
	const [members, setMembers] = useState<MemberListItem[]>([]);
	const [total, setTotal] = useState(0);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = useCallback(async (term: string) => {
		setLoading(true);
		try {
			const result = await listMembers({ search: term, role: "member", limit: 100 });
			setMembers(result.items);
			setTotal(result.meta.total);
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

	return (
		<section className="view-stack">
			<div className="section-heading">
				<div><p className="eyebrow">Members</p><h2>Gym members</h2></div>
			</div>

			<div className="insight-grid">
				<article className="insight-card accent-card">
					<Users size={19} /><strong>{total}</strong><span>total members</span>
				</article>
				<article className="insight-card">
					<CalendarCheck size={19} /><strong>{activeCount}</strong><span>active now</span>
				</article>
			</div>

			<div className="search-row">
				<Search size={16} />
				<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone" aria-label="Search members" />
			</div>

			{error && <div className="error-message">{error}</div>}

			{loading ? (
				<div className="loading-state">Loading members...</div>
			) : members.length === 0 ? (
				<div className="empty-state">No members matched your search.</div>
			) : (
				<div className="history-list">
					{members.map((member) => (
						<button className="history-row pass-row" key={member.id} onClick={() => onOpenMember(member.id)}>
							<div>
								<strong>{member.full_name}</strong>
								<span>{member.phone} · joined {dateLabel(member.gym_meta.joined_on)}</span>
							</div>
							<div className="pass-row-right">
								<span className={member.gym_meta.membership_status === "active" ? "status-dot" : "muted"}>
									{member.gym_meta.membership_status}
								</span>
							</div>
							<ChevronRight size={17} />
						</button>
					))}
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
				profile.active_subscription_id
					? getSubscriptionById(profile.active_subscription_id)
					: Promise.resolve(null),
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
				<button className="primary-action compact-button" onClick={mark} disabled={marking || presentToday}>
					{marking ? "Marking..." : presentToday ? "Present today" : "Mark attendance"}
				</button>
			</div>

			{notice && <div className="profile-message">{notice}</div>}
			{error && <div className="error-message">{error}</div>}

			<div className="insight-grid">
				<article className="insight-card accent-card">
					<CalendarCheck size={19} /><strong>{attendance.length}</strong><span>total visits</span>
				</article>
				<article className="insight-card">
					<Clock size={19} /><strong>{subscription?.days_remaining ?? 0}</strong><span>visits left</span>
				</article>
			</div>

			<div className="section-heading"><h2>Details</h2></div>
			<div className="detail-list">
				<Detail label="Phone" value={member.phone} />
				<Detail label="Email" value={member.email ?? "Not added"} />
				<Detail label="Joined" value={dateLabel(member.gym_meta?.joined_on)} />
				<Detail label="Blood group" value={member.profile?.blood_group ?? "Not added"} />
				<Detail label="Address" value={[member.profile?.address?.city, member.profile?.address?.state].filter(Boolean).join(", ") || "Not added"} />
				<Detail label="Current plan" value={subscription?.plan_snapshot.plan_name ?? "No active plan"} />
				{subscription && <Detail label="Expires" value={dateLabel(subscription.expires_on)} />}
			</div>

			<div className="section-heading">
				<h2>Attendance</h2>
				<span className="muted">{attendance.length} visits</span>
			</div>
			{attendance.length === 0 ? (
				<div className="empty-state">No visits recorded yet.</div>
			) : (
				<div className="history-list">
					{attendance.slice(0, 20).map((entry) => (
						<article className="history-row" key={`${entry.date}-${entry.check_in_time}`}>
							<div>
								<strong>{dateLabel(entry.date)}</strong>
								<span>{new Date(entry.check_in_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
							</div>
						</article>
					))}
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
function AttendanceRecorder() {
	const [members, setMembers] = useState<MemberListItem[]>([]);
	const [today, setToday] = useState<TodayCheckIn[]>([]);
	const [summary, setSummary] = useState<TrainerDashboard | null>(null);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [markingId, setMarkingId] = useState<string | null>(null);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");

	const load = useCallback(async (term: string) => {
		setLoading(true);
		const [memberResult, todayResult, summaryResult] = await Promise.allSettled([
			listMembers({ search: term, role: "member", limit: 100 }),
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
			const [refreshedToday, refreshedSummary] = await Promise.allSettled([
				getTodayCheckIns(),
				getTrainerDashboard(),
			]);
			if (refreshedToday.status === "fulfilled") setToday(refreshedToday.value);
			if (refreshedSummary.status === "fulfilled") setSummary(refreshedSummary.value);
		} catch (requestError) {
			setError(apiErrorMessage(requestError));
		} finally {
			setMarkingId(null);
		}
	}

	return (
		<section className="view-stack">
			<div className="section-heading">
				<div><p className="eyebrow">Record</p><h2>Mark attendance</h2></div>
				<span className="muted">{today.length} checked in today</span>
			</div>

			{summary && (
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
				<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone" aria-label="Search members" />
			</div>

			{error && <div className="error-message">{error}</div>}
			{notice && <div className="profile-message">{notice}</div>}

			{loading ? (
				<div className="loading-state">Loading members...</div>
			) : members.length === 0 ? (
				<div className="empty-state">No members matched your search.</div>
			) : (
				<div className="history-list">
					{members.map((member) => {
						const done = checkedInIds.has(member.id);
						return (
							<article className="history-row" key={member.id}>
								<div>
									<strong>{member.full_name}</strong>
									<span>{member.phone} · {member.gym_meta.membership_status}</span>
								</div>
								{done ? (
									<span className="status-dot">Present today</span>
								) : (
									<button className="outline-button compact-button" onClick={() => mark(member)} disabled={markingId === member.id}>
										{markingId === member.id ? "Marking..." : <>Mark present <ChevronRight size={15} /></>}
									</button>
								)}
							</article>
						);
					})}
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
					<span className="muted">{members.total_registered} registered</span>
				</div>

				<div className="insight-grid">
					<article className="insight-card accent-card">
						<Users size={19} /><strong>{members.total_registered}</strong><span>total registered</span>
					</article>
					<article className="insight-card">
						<CalendarCheck size={19} /><strong>{members.active}</strong><span>active members</span>
					</article>
					<article className="insight-card">
						<Clock size={19} /><strong>{members.inactive}</strong><span>inactive</span>
					</article>
				</div>

				<div className="detail-list">
					<Detail label="Lapsed — bought before, not renewed" value={String(members.lapsed)} />
					<Detail label="Never bought a plan" value={String(members.never_subscribed)} />
					<Detail label="Suspended accounts" value={String(members.suspended)} />
					<Detail label="Joined this month" value={String(members.joined_this_month)} />
				</div>

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
					<span className="muted">{plans.total_plans} in catalogue</span>
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
	// Scale to a rounded ceiling rather than the largest value, so the leader
	// does not always fill the track. Without this, several plans tied at the
	// top all read as 100% and the chart says nothing about scale.
	const peak = Math.max(1, ...rows.map((item) => item.active_members));
	const max = peak <= 5 ? peak + 1 : Math.ceil(peak * 1.15);

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
			<div className="section-heading">
				<h3>Members per plan</h3>
				<span className="muted">current members</span>
			</div>

			<div className="chart-panel">
				{rows.map((item) => {
					const percent = (item.active_members / max) * 100;
					return (
						<div className="chart-row" key={item.plan_id}>
							<span className="chart-label" title={item.plan_name}>
								{item.plan_name}
								{!item.is_active && <em className="chart-archived"> archived</em>}
							</span>
							<span className="chart-track">
								<span
									className="chart-bar"
									style={{
										width: `${Math.max(percent, item.active_members > 0 ? 3 : 0)}%`,
										// One hue, deeper with magnitude: sequential, not categorical.
										opacity: 0.5 + (item.active_members / peak) * 0.5,
									}}
								/>
							</span>
							<span className="chart-value">
								<strong>{item.active_members}</strong>
								<small>{item.total_sold} sold</small>
							</span>
						</div>
					);
				})}
			</div>

			{/* A table view, so the figures are readable without relying on the bars. */}
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
