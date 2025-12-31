import {
    getAllMasterData,
    addMasterData,
    updateMasterData,
    softDeleteMasterData,
    restoreMasterData,
    getAllDropdownData // For populating parent dropdowns
} from './firestore-service.js';
import { getUserId } from './auth-helper.js';
import { auth } from './firebase-config.js';

let currentCollection = 'categories';
let allData = {}; // Cache for generic data
let dropdownData = {}; // Cache for parent dropdowns
let showDeleted = false;

$(document).ready(function () {
    init();
});

async function init() {
    loadUserProfile();

    // Load dropdown data once for lookup (Categories, PaymentTypes)
    dropdownData = await getAllDropdownData();

    // Load initial tab data
    loadTabData('categories');

    // Tab Click Handlers
    $('button[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
        const collection = $(e.target).data('collection');
        const title = $(e.target).text();
        $("#currentTabTitle").text(title);
        currentCollection = collection;
        loadTabData(collection);
    });

    $("#btnAddNew").click(function () {
        openModal();
    });

    // Show Deleted Checkbox
    $("#chkShowDeleted").change(function () {
        showDeleted = $(this).is(':checked');
        if (allData[currentCollection]) {
            renderTable(currentCollection, allData[currentCollection]);
        }
    });

    // Save Button
    $("#btnSaveData").click(function () {
        saveData();
    });
}

async function loadTabData(collectionName) {
    $("#loadingSpinner").removeClass('d-none');
    $("#dataTable").addClass('d-none');
    $("#tableBody").empty();

    try {
        const data = await getAllMasterData(collectionName);
        allData[collectionName] = data; // Cache it
        renderTable(collectionName, data);
    } catch (error) {
        console.error("Error loading data:", error);
        toastr.error("Failed to load data.");
    } finally {
        $("#loadingSpinner").addClass('d-none');
        $("#dataTable").removeClass('d-none');
    }
}

function renderTable(collection, data) {
    const thead = $("#tableHeaderRow");
    const tbody = $("#tableBody");
    thead.empty();
    tbody.empty();

    // Define columns based on collection
    let columns = [{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }];

    if (collection === 'subCategories') {
        columns.push({ key: 'categoryId', label: 'Parent Category', type: 'lookup', source: dropdownData.Category });
    } else if (collection === 'paymentSubTypes') {
        columns.push({ key: 'paymentTypeId', label: 'Payment Type', type: 'lookup', source: dropdownData.PaymentType });
        columns.push({ key: 'billDueDay', label: 'Bill Due Day' });
    }

    // Render Headers
    columns.forEach(col => {
        thead.append(`<th>${col.label}</th>`);
    });
    thead.append('<th class="text-end">Actions</th>');

    // Render Rows
    data.forEach(item => {
        const isDeleted = item.isDeleted === true;
        if (isDeleted && !showDeleted) return; // Skip deleted items if not showing them

        let trClass = isDeleted ? 'deleted-row' : '';

        // Build Row HTML
        let tr = `<tr class="${trClass}">`;

        columns.forEach(col => {
            let val = item[col.key] || '-';

            // Handle Lookups
            if (col.type === 'lookup' && col.source) {
                const found = col.source.find(x => x.Value == val);
                val = found ? found.Text : `ID: ${val}`;
            }

            tr += `<td>${val}</td>`;
        });

        // Actions
        let actionBtn = '';
        if (isDeleted) {
            actionBtn = `
                <span class="badge bg-secondary me-2">Deleted</span>
                <span class="material-icons text-success action-btn" title="Restore" onclick="handleRestore('${item.docId}')">restore_from_trash</span>
            `;
        } else {
            actionBtn = `
                <span class="material-icons text-primary action-btn me-2" title="Edit" onclick="handleEdit('${item.docId}')">edit</span>
                <span class="material-icons text-danger action-btn" title="Delete" onclick="handleDelete('${item.docId}')">delete</span>
            `;
        }

        tr += `<td class="text-end actions-cell">${actionBtn}</td>`;
        tr += `</tr>`;

        tbody.append(tr);
    });

    if (data.length === 0) {
        tbody.append(`<tr><td colspan="${columns.length + 1}" class="text-center text-muted py-4">No data found.</td></tr>`);
    }

    // Attach handlers to window for inline onclicks (hacky but quick for simple CRUD)
    window.handleEdit = (id) => openModal(id);
    window.handleDelete = (id) => deleteItem(id);
    window.handleRestore = (id) => restoreItem(id);
}

function openModal(id = null) {
    const isEdit = id !== null;
    $("#dataModalLabel").text(isEdit ? "Edit Item" : "Add New Item");
    $("#itemId").val(id || "");
    $("#itemName").val("");
    $("#dynamicFields").empty();

    // Populate Dynamic Fields based on Collection
    if (currentCollection === 'subCategories') {
        const categories = dropdownData.Category || [];
        const options = categories.map(c => `<option value="${c.Value}">${c.Text}</option>`).join('');

        $("#dynamicFields").append(`
            <div class="mb-3">
                <label class="form-label">Parent Category</label>
                <select class="form-select" id="field_categoryId" required>
                    <option value="" disabled selected>Select Category</option>
                    ${options}
                </select>
            </div>
        `);
    } else if (currentCollection === 'paymentSubTypes') {
        const types = dropdownData.PaymentType || [];
        const options = types.map(t => `<option value="${t.Value}">${t.Text}</option>`).join('');

        $("#dynamicFields").append(`
            <div class="mb-3">
                <label class="form-label">Payment Type</label>
                <select class="form-select" id="field_paymentTypeId" required>
                    <option value="" disabled selected>Select Type</option>
                    ${options}
                </select>
            </div>
             <div class="mb-3">
                <label class="form-label">Bill Due Day (Optional)</label>
                <input type="number" class="form-control" id="field_billDueDay" placeholder="e.g. 15">
            </div>
        `);
    }

    // Pre-fill if Edit
    if (isEdit) {
        const item = allData[currentCollection].find(i => i.docId == id);
        if (item) {
            $("#itemName").val(item.name);
            if (item.categoryId) $("#field_categoryId").val(item.categoryId);
            if (item.paymentTypeId) $("#field_paymentTypeId").val(item.paymentTypeId);
            if (item.billDueDay) $("#field_billDueDay").val(item.billDueDay);
        }
    }

    const modal = new bootstrap.Modal(document.getElementById('dataModal'));
    modal.show();
}

async function saveData() {
    const id = $("#itemId").val();
    const name = $("#itemName").val().trim();

    if (!name) {
        toastr.warning("Name is required.");
        return;
    }

    const data = { name: name };

    // Capture dynamic fields
    if ($("#field_categoryId").length) data.categoryId = parseInt($("#field_categoryId").val());
    if ($("#field_paymentTypeId").length) data.paymentTypeId = parseInt($("#field_paymentTypeId").val());
    if ($("#field_billDueDay").val()) data.billDueDay = $("#field_billDueDay").val();

    // Validate relations
    if (currentCollection === 'subCategories' && !data.categoryId) {
        toastr.warning("Parent Category is required.");
        return;
    }
    if (currentCollection === 'paymentSubTypes' && !data.paymentTypeId) {
        toastr.warning("Payment Type is required.");
        return;
    }

    try {
        if (id) {
            await updateMasterData(currentCollection, id, data);
            // id is string docId now, so passing directly.
            toastr.success("Updated successfully.");
        } else {
            await addMasterData(currentCollection, data);
            toastr.success("Added successfully.");
        }

        bootstrap.Modal.getInstance(document.getElementById('dataModal')).hide();
        loadTabData(currentCollection); // Reload

        // Refresh dropdown cache if we changed categories/types
        if (['categories', 'paymentTypes'].includes(currentCollection)) {
            dropdownData = await getAllDropdownData();
        }

    } catch (error) {
        console.error("Error saving:", error);
        toastr.error("Failed to save.");
    }
}

async function deleteItem(id) {
    if (!confirm("Are you sure you want to delete this item? It will be archived.")) return;

    try {
        await softDeleteMasterData(currentCollection, id);
        toastr.success("Item deleted.");
        loadTabData(currentCollection);
        // Refresh cache
        if (['categories', 'paymentTypes'].includes(currentCollection)) {
            dropdownData = await getAllDropdownData();
        }
    } catch (error) {
        toastr.error("Failed to delete.");
    }
}

async function restoreItem(id) {
    if (!confirm("Restore this item?")) return;
    try {
        await restoreMasterData(currentCollection, id);
        toastr.success("Item restored.");
        loadTabData(currentCollection);
        // Refresh cache
        if (['categories', 'paymentTypes'].includes(currentCollection)) {
            dropdownData = await getAllDropdownData();
        }
    } catch (error) {
        toastr.error("Failed to restore.");
    }
}


function loadUserProfile() {
    const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) {
            document.getElementById('userName').textContent = user.displayName || 'User';
            document.getElementById('userEmail').textContent = user.email || '';
        } else {
            window.location.href = 'Login.html';
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', function (e) {
        e.preventDefault();
        auth.signOut().then(() => {
            window.location.href = 'Login.html';
        });
    });
}
