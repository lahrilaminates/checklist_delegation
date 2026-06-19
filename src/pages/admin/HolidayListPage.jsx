
import React, { useState, useEffect } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { Calendar as CalendarIcon, Plus, Trash2, Search, Loader2 } from 'lucide-react';
import supabase from '../../SupabaseClient';

const HolidayListPage = () => {
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [newHoliday, setNewHoliday] = useState({
        holiday_date: '',
        holiday_name: ''
    });

    useEffect(() => {
        fetchHolidays();
    }, []);

    const fetchHolidays = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('holidays')
                .select('*')
                .order('holiday_date', { ascending: true });

            if (error) {
                if (error.code === '42P01') {
                    setHolidays([]);
                } else {
                    throw error;
                }
            } else {
                setHolidays(data || []);
            }
        } catch (err) {
            console.error('Error fetching holidays:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddHoliday = async (e) => {
        e.preventDefault();
        if (!newHoliday.holiday_date || !newHoliday.holiday_name) return;

        try {
            setIsSubmitting(true);

            const selectedDate = newHoliday.holiday_date; // YYYY-MM-DD
            const startOfDay = `${selectedDate}T00:00:00.000Z`;
            const endOfDay = `${selectedDate}T23:59:59.999Z`;

            // 1. Insert into holidays table
            const { error: holidayError } = await supabase
                .from('holidays')
                .insert([newHoliday]);

            if (holidayError) throw holidayError;

            // 2. Remove from working_day_calender
            await supabase
                .from('working_day_calender')
                .delete()
                .eq('working_date', selectedDate);

            // 3. Remove assigned tasks from all relevant tables for this specific day
            // Tables: checklist, delegation, maintenance_tasks (column: task_start_date)
            // Table: ea_tasks (column: planned_date)

            const cleanupResults = await Promise.allSettled([
                supabase.from('checklist').delete().gte('task_start_date', startOfDay).lte('task_start_date', endOfDay),
                supabase.from('delegation').delete().gte('task_start_date', startOfDay).lte('task_start_date', endOfDay),
                supabase.from('maintenance_tasks').delete().gte('task_start_date', startOfDay).lte('task_start_date', endOfDay),
                supabase.from('ea_tasks').delete().gte('planned_date', startOfDay).lte('planned_date', endOfDay)
            ]);

            cleanupResults.forEach((result, index) => {
                if (result.status === 'rejected') {
                    console.error(`Cleanup failed for table index ${index}:`, result.reason);
                } else if (result.value.error) {
                    console.error(`Cleanup error for table index ${index}:`, result.value.error);
                }
            });

            console.log(`Cleaned up tasks for holiday: ${selectedDate}`);

            setNewHoliday({ holiday_date: '', holiday_name: '' });
            fetchHolidays();
            alert('Holiday added and tasks cleaned up successfully!');
        } catch (err) {
            console.error('Error adding holiday:', err);
            alert(`Error adding holiday: ${err.message || 'Unknown error'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteHoliday = async (holiday) => {
        if (!window.confirm(`Delete holiday "${holiday.holiday_name}"?`)) return;

        try {
            const { error: deleteError } = await supabase
                .from('holidays')
                .delete()
                .eq('id', holiday.id);

            if (deleteError) throw deleteError;

            const dateObj = new Date(holiday.holiday_date);
            const dow = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ...

            // Only insert into working_day_calender if it's not a Sunday (matches WHERE EXTRACT(DOW FROM gs) != 0)
            if (dow !== 0) {
                const hindiDays = {
                    1: 'सोम',
                    2: 'मंगल',
                    3: 'बुध',
                    4: 'गुरु',
                    5: 'शुक्र',
                    6: 'शनि'
                };

                const dayName = hindiDays[dow];
                const monthNum = dateObj.getMonth() + 1;

                // ISO Week Number calculation (matches Postgres EXTRACT(WEEK FROM ...))
                const getISOWeek = (date) => {
                    const d = new Date(date);
                    d.setHours(0, 0, 0, 0);
                    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
                    const yearStart = new Date(d.getFullYear(), 0, 1);
                    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
                };

                const weekNum = getISOWeek(dateObj);

                await supabase.from('working_day_calender').insert([{
                    working_date: holiday.holiday_date,
                    day: dayName,
                    week_num: weekNum,
                    month: monthNum
                }]);
            }

            fetchHolidays();
        } catch (err) {
            console.error('Error deleting holiday:', err);
        }
    };

    const filteredHolidays = holidays.filter(h =>
        h.holiday_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.holiday_date.includes(searchTerm)
    );

    return (
        <AdminLayout>
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header Section */}
                <div className="bg-white border-b border-gray-200 pb-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-700 rounded text-white font-bold">
                            <CalendarIcon size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Holiday List</h1>
                            <p className="text-sm text-gray-500 font-medium">Manage and view annual holidays</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Entry Form */}
                    <div className="md:col-span-1">
                        <div className="bg-white border border-gray-200 rounded shadow-sm">
                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <Plus size={16} /> Add New Entry
                                </h2>
                            </div>
                            <form onSubmit={handleAddHoliday} className="p-4 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">
                                        Holiday Name
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none"
                                        value={newHoliday.holiday_name}
                                        onChange={(e) => setNewHoliday({ ...newHoliday, holiday_name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">
                                        Select Date
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:border-blue-500 outline-none"
                                        value={newHoliday.holiday_date}
                                        onChange={(e) => setNewHoliday({ ...newHoliday, holiday_date: e.target.value })}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded font-bold text-xs transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : 'Save Record'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="md:col-span-2">
                        <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden h-full flex flex-col">
                            <div className="p-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3">
                                <h2 className="text-sm font-bold text-gray-700">
                                    Existing Holidays ({filteredHolidays.length})
                                </h2>
                                <div className="relative w-full sm:w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded text-xs focus:border-blue-500 outline-none"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100 border-b border-gray-200">
                                            <th className="px-4 py-3 font-bold text-gray-600 text-xs uppercase">Date</th>
                                            <th className="px-4 py-3 font-bold text-gray-600 text-xs uppercase">Name</th>
                                            <th className="px-4 py-3 font-bold text-gray-600 text-xs uppercase text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="3" className="px-4 py-10 text-center text-gray-400 italic">
                                                    Loading data...
                                                </td>
                                            </tr>
                                        ) : filteredHolidays.length === 0 ? (
                                            <tr>
                                                <td colSpan="3" className="px-4 py-10 text-center text-gray-400 font-bold">
                                                    NO RECORDS FOUND
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredHolidays.map((holiday) => (
                                                <tr key={holiday.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="font-bold text-gray-900">
                                                            {new Date(holiday.holiday_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 uppercase font-medium">
                                                            {new Date(holiday.holiday_date).toLocaleDateString('en-GB', { weekday: 'long' })}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 font-medium text-gray-700">
                                                        {holiday.holiday_name}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <button
                                                            onClick={() => handleDeleteHoliday(holiday)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default HolidayListPage;
