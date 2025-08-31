import { useState, useEffect } from 'react';
import customDataFieldGroupService from '../services/customDataFieldGroupService';

const useCustomDataFieldGroups = (type) => {
  const [groups, setGroups] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        setError(null);
        
        if (type) {
          // Get specific group by type
          const group = await customDataFieldGroupService.getGroupByType(type);
          setGroups([group]);
          setFields(group.fields || []);
        } else {
          // Get all groups
          const allGroups = await customDataFieldGroupService.getAllGroups();
          setGroups(allGroups);
          setFields([]);
        }
      } catch (err) {
        console.error('Error fetching custom data field groups:', err);
        setError(err.message || 'Failed to fetch custom data field groups');
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, [type]);

  const refreshGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (type) {
        const group = await customDataFieldGroupService.getGroupByType(type);
        setGroups([group]);
        setFields(group.fields || []);
      } else {
        const allGroups = await customDataFieldGroupService.getAllGroups();
        setGroups(allGroups);
        setFields([]);
      }
    } catch (err) {
      console.error('Error refreshing custom data field groups:', err);
      setError(err.message || 'Failed to refresh custom data field groups');
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (groupData) => {
    try {
      const newGroup = await customDataFieldGroupService.createGroup(groupData);
      setGroups(prev => [...prev, newGroup]);
      return newGroup;
    } catch (err) {
      console.error('Error creating custom data field group:', err);
      throw err;
    }
  };

  const updateGroup = async (id, updateData) => {
    try {
      const updatedGroup = await customDataFieldGroupService.updateGroup(id, updateData);
      setGroups(prev => prev.map(group => 
        group._id === id ? updatedGroup : group
      ));
      
      if (type && updatedGroup.type === type) {
        setFields(updatedGroup.fields || []);
      }
      
      return updatedGroup;
    } catch (err) {
      console.error('Error updating custom data field group:', err);
      throw err;
    }
  };

  const deleteGroup = async (id) => {
    try {
      await customDataFieldGroupService.deleteGroup(id);
      setGroups(prev => prev.filter(group => group._id !== id));
      
      if (type) {
        const remainingGroup = groups.find(group => group.type === type);
        setFields(remainingGroup?.fields || []);
      }
    } catch (err) {
      console.error('Error deleting custom data field group:', err);
      throw err;
    }
  };

  return {
    groups,
    fields,
    loading,
    error,
    refreshGroups,
    createGroup,
    updateGroup,
    deleteGroup
  };
};

export default useCustomDataFieldGroups;
