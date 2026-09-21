import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgePercent, CalendarCheck, ChevronRight, Dumbbell, LayoutGrid, LogOut, Moon, Search, Sun, Users } from "lucide-react";

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
	setPlanActive,
	updatePlan,
	type Plan,
	type PlanWritePayload,
} from "../../services/planService";
import { getTodayCheckIns, markAttendance, type TodayCheckIn } from "../../services/checkinService";
import { listMembers, type MemberListItem } from "../../services/userService";
import { roleLabels } from "../../router/routes";
import type { AuthUser } from "../../store/authStore";

type StaffTab = "plans" | "coupons" | "members";

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
	// Trainers manage attendance only; plan/coupon control is Admin-only.
	const [tab, setTab] = useState<StaffTab>(isAdmin ? "plans" : "members");

	const tabs = useMemo(
		() =>
			(isAdmin
				? ([
						["plans", LayoutGrid, "Plans"],
						["coupons", BadgePercent, "Coupons"],
						["members", Users, "Members"],
				  ] as const)
				: ([["members", Users, "Members"]] as const)),
		[isAdmin],
	);

	return (
		<div className="dashboard">
			<header className="mobile-header">
				<div className="brand">
					<span className="brand-mark"><Dumbbell size={17} /></span>
					<span className="brand-text">FITCORE</span>
				</div>
				<div className="header-actions">
					<span className="role-chip">{roleLabels[user.role]}</span>
					<button className="icon-button" onClick={() => setDarkMode(!darkMode)} aria-label="Toggle theme">
						{darkMode ? <Sun size={18} /> : <Moon size={18} />}
					</button>
					<button className="icon-button" onClick={onLogout} aria-label="Sign out"><LogOut size={18} /></button>
				</div>
			</header>

			<main className="staff-main">
				<div className="page-title">
					<p className="eyebrow">{roleLabels[user.role]} workspace</p>
					<h1>Good to see you, {user.full_name.split(" ")[0]}.</h1>
				</div>

				{tabs.length > 1 && (
					<div className="staff-tabs" role="tablist">
						{tabs.map(([key, Icon, label]) => (
							<button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "staff-tab active" : "staff-tab"} onClick={() => setTab(key)}>
								<Icon size={16} /> {label}
							</button>
						))}
					</div>
				)}

				{tab === "plans" && isAdmin && <PlanManager />}
				{tab === "coupons" && isAdmin && <CouponManager />}
				{tab === "members" && <MemberManager />}
			</main>
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

	return (
		<section className="view-stack">
			<div className="section-heading">
				<div><p className="eyebrow">Plan management</p><h2>Membership plans</h2></div>
				<button className="primary-action compact-button" onClick={openCreate}>New plan</button>
			</div>

			{error && <div className="error-message">{error}</div>}
			{notice && <div className="profile-message">{notice}</div>}

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

			{loading ? <div className="loading-state">Loading plans...</div> : plans.length === 0 ? <div className="empty-state">No plans yet. Create your first plan.</div> : (
				<div className="plan-list">
					{plans.map((plan) => (
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
								<button className="outline-button compact-button" onClick={() => openEdit(plan)}>Edit</button>
								<button className="outline-button compact-button" onClick={() => toggleActive(plan)}>{plan.is_active ? "Deactivate" : "Activate"}</button>
							</div>
						</article>
					))}
				</div>
			)}
		</section>
	);
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

	return (
		<section className="view-stack">
			<div className="section-heading">
				<div><p className="eyebrow">Coupon management</p><h2>Discount coupons</h2></div>
				<button className="primary-action compact-button" onClick={() => { setForm(emptyCouponForm); setShowForm(true); setNotice(""); setError(""); }}>New coupon</button>
			</div>

			{error && <div className="error-message">{error}</div>}
			{notice && <div className="profile-message">{notice}</div>}

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

			{loading ? <div className="loading-state">Loading coupons...</div> : coupons.length === 0 ? <div className="empty-state">No coupons yet.</div> : (
				<div className="history-list">
					{coupons.map((coupon) => (
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
					))}
				</div>
			)}
		</section>
	);
}

/* ── Trainer/Admin: members and attendance ──────────────────────────────── */

function MemberManager() {
	const [members, setMembers] = useState<MemberListItem[]>([]);
	const [today, setToday] = useState<TodayCheckIn[]>([]);
	const [search, setSearch] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [markingId, setMarkingId] = useState<string | null>(null);

	const load = useCallback(async (term: string) => {
		setLoading(true);
		const [memberResult, todayResult] = await Promise.allSettled([
			listMembers({ search: term, role: "member", limit: 50 }),
			getTodayCheckIns(),
		]);
		if (memberResult.status === "fulfilled") { setMembers(memberResult.value.items); setError(""); }
		else setError(apiErrorMessage(memberResult.reason));
		if (todayResult.status === "fulfilled") setToday(todayResult.value);
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
			setToday(await getTodayCheckIns());
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
