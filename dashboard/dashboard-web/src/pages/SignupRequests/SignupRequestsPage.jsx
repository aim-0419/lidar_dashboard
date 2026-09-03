import { useEffect, useEffectEvent, useState } from "react";
import { Check, ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  approveSignupRequest,
  fetchSignupRequests,
  rejectSignupRequest,
} from "../../shared/api/http";
import "./signupRequests.css";

const PAGE_SIZE = 20;
const STATUS_LABELS = {
  PENDING: "대기",
  APPROVED: "승인",
  REJECTED: "반려",
  CANCELLED: "취소",
};

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "-";
}

export default function SignupRequestsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({ count: 0, page: 1, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isSuperAdmin = user?.role === "super_admin";

  async function loadRequests(nextStatus = status, nextPage = page) {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchSignupRequests(nextStatus, nextPage, PAGE_SIZE);
      setRequests(response.requests || []);
      setPagination({
        count: response.count || 0,
        page: response.page || nextPage,
        totalPages: response.totalPages || 1,
      });
    } catch (error) {
      setErrorMessage(error.message || "가입 신청 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  const loadRequestsOnFilterChange = useEffectEvent((nextStatus, nextPage) => {
    void loadRequests(nextStatus, nextPage);
  });

  useEffect(() => {
    if (isSuperAdmin) {
      loadRequestsOnFilterChange(status, page);
    }
  }, [isSuperAdmin, page, status]);

  function handleStatusChange(nextStatus) {
    setStatus(nextStatus);
    setPage(1);
    setSuccessMessage("");
  }

  async function handleApprove(id) {
    setBusyId(id);
    setErrorMessage("");

    try {
      await approveSignupRequest(id);
      setSuccessMessage("가입 신청을 승인했습니다.");
      await loadRequests();
    } catch (error) {
      setErrorMessage(error.message || "가입 신청을 승인하지 못했습니다.");
    } finally {
      setBusyId("");
    }
  }

  async function handleReject(id) {
    const rejectReason = window.prompt("반려 사유를 입력하세요. 입력하지 않으면 사유 없이 반려됩니다.") || "";
    setBusyId(id);
    setErrorMessage("");

    try {
      await rejectSignupRequest(id, rejectReason);
      setSuccessMessage("가입 신청을 반려했습니다.");
      await loadRequests();
    } catch (error) {
      setErrorMessage(error.message || "가입 신청을 반려하지 못했습니다.");
    } finally {
      setBusyId("");
    }
  }

  if (!isSuperAdmin) {
    return (
      <section className="ops-page signup-admin-page">
        <div className="signup-admin-empty">최고 관리자만 가입 신청을 관리할 수 있습니다.</div>
      </section>
    );
  }

  return (
    <section className="ops-page signup-admin-page">
      <header className="signup-admin-header">
        <div>
          <p>ADMINISTRATION</p>
          <h1>가입 신청 관리</h1>
          <span>신청 상태를 확인하고 대기 계정을 승인 또는 반려합니다.</span>
        </div>
        <button type="button" onClick={() => void loadRequests()} disabled={isLoading}>
          <RefreshCw size={16} /> 새로고침
        </button>
      </header>

      <div className="signup-admin-filters" role="tablist" aria-label="가입 신청 상태">
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={status === value ? "active" : ""}
            onClick={() => handleStatusChange(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {errorMessage ? <p className="signup-admin-message error">{errorMessage}</p> : null}
      {successMessage ? <p className="signup-admin-message success">{successMessage}</p> : null}

      <div className="signup-request-list">
        {isLoading ? <p>가입 신청 목록을 불러오는 중입니다.</p> : null}
        {!isLoading && requests.length === 0 ? <p>해당 상태의 가입 신청이 없습니다.</p> : null}
        {requests.map((request) => (
          <article key={request.id} className="signup-request-card">
            <div className="signup-request-card__head">
              <div>
                <strong>{request.name}</strong>
                <span>{request.userId}</span>
              </div>
              <b className={`status-${String(request.status).toLowerCase()}`}>
                {STATUS_LABELS[request.status] || request.status}
              </b>
            </div>
            <dl>
              <div><dt>이메일</dt><dd>{request.email}</dd></div>
              <div><dt>전화번호</dt><dd>{request.phoneNumber}</dd></div>
              <div><dt>신청일</dt><dd>{formatDate(request.createdAt)}</dd></div>
              <div><dt>처리일</dt><dd>{formatDate(request.reviewedAt || request.cancelledAt)}</dd></div>
            </dl>
            {request.rejectReason ? <p className="signup-request-card__reason">반려 사유: {request.rejectReason}</p> : null}
            {request.status === "PENDING" ? (
              <div className="signup-request-card__actions">
                <button type="button" className="approve" disabled={busyId === request.id} onClick={() => void handleApprove(request.id)}>
                  <Check size={16} /> 승인
                </button>
                <button type="button" className="reject" disabled={busyId === request.id} onClick={() => void handleReject(request.id)}>
                  <X size={16} /> 반려
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {!isLoading && pagination.totalPages > 1 ? (
        <nav className="signup-request-pagination" aria-label="가입 신청 목록 페이지 이동">
          <button
            type="button"
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            disabled={pagination.page <= 1}
          >
            <ChevronLeft size={16} /> 이전
          </button>
          <span>{pagination.page} / {pagination.totalPages} 페이지 · 총 {pagination.count}건</span>
          <button
            type="button"
            onClick={() => setPage((currentPage) => Math.min(pagination.totalPages, currentPage + 1))}
            disabled={pagination.page >= pagination.totalPages}
          >
            다음 <ChevronRight size={16} />
          </button>
        </nav>
      ) : null}
    </section>
  );
}
